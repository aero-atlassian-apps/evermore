'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    ConversationInitData,
    ServerToClientEvent,
    TranscriptEntry,
    ConversationPhase,
    ElevenLabsConversationState,
    WarmUpPhaseResult,
} from '@/lib/types/elevenlabs-websocket';

interface UseElevenLabsConversationOptions {
    agentId: string;
    userName: string;
    onTranscriptUpdate?: (transcript: TranscriptEntry[]) => void;
    onAudioReceived?: (audioBase64: string) => void;
    onReadyToTransition?: () => void;
    onError?: (error: string) => void;
}

// Phrases that indicate the agent is ready for the user to click the button
const READY_PHRASES = [
    'click the button',
    'click the start',
    "when you're ready",
    'start telling story',
    'ready to begin',
    'go ahead and click',
];

export function useElevenLabsConversation(options: UseElevenLabsConversationOptions) {
    const { agentId, userName, onTranscriptUpdate, onAudioReceived, onReadyToTransition, onError } = options;

    const [state, setState] = useState<ElevenLabsConversationState>({
        phase: 'idle',
        isConnected: false,
        isSpeaking: false,
        isListening: false,
        transcript: [],
        conversationId: null,
        error: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
    const startTimeRef = useRef<number>(0);

    // Audio playback queue
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);

    // Check if agent response indicates ready to transition
    const checkReadyToTransition = useCallback((text: string) => {
        const lowerText = text.toLowerCase();
        return READY_PHRASES.some(phrase => lowerText.includes(phrase));
    }, []);

    // Play audio from base64
    const playAudioChunk = useCallback(async (base64Audio: string) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        }

        try {
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Decode audio data (assuming PCM 16-bit mono)
            const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 16000);
            const channelData = audioBuffer.getChannelData(0);
            const dataView = new DataView(bytes.buffer);

            for (let i = 0; i < bytes.length / 2; i++) {
                channelData[i] = dataView.getInt16(i * 2, true) / 32768;
            }

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();

            onAudioReceived?.(base64Audio);
        } catch (err) {
            console.error('[ElevenLabs] Audio playback error:', err);
        }
    }, [onAudioReceived]);

    // Process audio queue
    const processAudioQueue = useCallback(async () => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

        isPlayingRef.current = true;
        setState(prev => ({ ...prev, isSpeaking: true }));

        while (audioQueueRef.current.length > 0) {
            const chunk = audioQueueRef.current.shift();
            if (chunk) {
                await playAudioChunk(chunk);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small gap between chunks
            }
        }

        isPlayingRef.current = false;
        setState(prev => ({ ...prev, isSpeaking: false }));
    }, [playAudioChunk]);

    // Handle WebSocket messages
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data) as ServerToClientEvent;

            switch (data.type) {
                case 'ping':
                    // Respond to keep-alive
                    wsRef.current?.send(JSON.stringify({
                        type: 'pong',
                        event_id: data.ping_event.event_id,
                    }));
                    break;

                case 'conversation_initiation_metadata':
                    setState(prev => ({
                        ...prev,
                        conversationId: data.conversation_initiation_metadata_event.conversation_id,
                        phase: 'active',
                    }));
                    break;

                case 'user_transcript':
                    const userText = data.user_transcription_event.user_transcript;
                    if (userText.trim()) {
                        setState(prev => {
                            const newTranscript = [...prev.transcript, {
                                speaker: 'user' as const,
                                text: userText,
                                timestamp: new Date().toISOString(),
                            }];
                            onTranscriptUpdate?.(newTranscript);
                            return { ...prev, transcript: newTranscript };
                        });
                    }
                    break;

                case 'agent_response':
                    const agentText = data.agent_response_event.agent_response;
                    if (agentText.trim()) {
                        setState(prev => {
                            const newTranscript = [...prev.transcript, {
                                speaker: 'agent' as const,
                                text: agentText,
                                timestamp: new Date().toISOString(),
                            }];
                            onTranscriptUpdate?.(newTranscript);

                            // Check if ready to transition
                            const isReady = checkReadyToTransition(agentText);
                            if (isReady && prev.phase !== 'ready_to_transition') {
                                onReadyToTransition?.();
                                return { ...prev, transcript: newTranscript, phase: 'ready_to_transition' };
                            }

                            return { ...prev, transcript: newTranscript };
                        });
                    }
                    break;

                case 'agent_response_correction':
                    // Update last agent message
                    setState(prev => {
                        const newTranscript = [...prev.transcript];
                        for (let i = newTranscript.length - 1; i >= 0; i--) {
                            if (newTranscript[i].speaker === 'agent') {
                                newTranscript[i].text = data.agent_response_correction_event.corrected_agent_response;
                                break;
                            }
                        }
                        onTranscriptUpdate?.(newTranscript);
                        return { ...prev, transcript: newTranscript };
                    });
                    break;

                case 'audio':
                    audioQueueRef.current.push(data.audio_event.audio_base_64);
                    processAudioQueue();
                    break;

                case 'interruption':
                    // Clear audio queue on interruption
                    audioQueueRef.current = [];
                    isPlayingRef.current = false;
                    setState(prev => ({ ...prev, isSpeaking: false }));
                    break;

                case 'internal_vad':
                    setState(prev => ({
                        ...prev,
                        isListening: data.internal_vad_event.type === 'speech_start',
                    }));
                    break;

                case 'conversation_ended':
                    setState(prev => ({ ...prev, phase: 'ended', isConnected: false }));
                    break;
            }
        } catch (err) {
            console.error('[ElevenLabs] Message parse error:', err);
        }
    }, [onTranscriptUpdate, onReadyToTransition, checkReadyToTransition, processAudioQueue]);

    // Setup audio capture
    const setupAudioCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            mediaStreamRef.current = stream;

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 16000 });
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);

            // Use ScriptProcessor for compatibility (AudioWorklet preferred but more complex)
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);

                for (let i = 0; i < inputData.length; i++) {
                    pcm16[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
                }

                const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

                wsRef.current.send(JSON.stringify({
                    user_audio_chunk: base64,
                }));
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination);

            return true;
        } catch (err) {
            console.error('[ElevenLabs] Audio capture setup failed:', err);
            onError?.('Failed to access microphone');
            return false;
        }
    }, [onError]);

    // Connect to ElevenLabs
    const connect = useCallback(async () => {
        if (wsRef.current) {
            console.log('[ElevenLabs] Already connected, skipping');
            return;
        }

        console.log('[ElevenLabs] Starting connection...');
        setState(prev => ({ ...prev, phase: 'connecting', error: null }));
        startTimeRef.current = Date.now();

        try {
            // Get signed URL from our backend
            console.log('[ElevenLabs] Fetching signed URL...');
            const response = await fetch('/api/conversation/warmup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ElevenLabs] Failed to get URL:', response.status, errorText);
                throw new Error('Failed to get conversation URL');
            }

            const { wsUrl } = await response.json();
            console.log('[ElevenLabs] Got signed URL, connecting to WebSocket...');

            // Connect to WebSocket
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                console.log('[ElevenLabs] WebSocket opened');
                setState(prev => ({ ...prev, isConnected: true }));

                // Send init data with dynamic variables
                const initData: ConversationInitData = {
                    type: 'conversation_initiation_client_data',
                    dynamic_variables: {
                        user_name: userName,
                    },
                };
                console.log('[ElevenLabs] Sending init data:', initData);
                ws.send(JSON.stringify(initData));

                // Setup audio capture
                console.log('[ElevenLabs] Setting up audio capture...');
                await setupAudioCapture();
            };

            ws.onmessage = handleMessage;

            ws.onerror = (err) => {
                console.error('[ElevenLabs] WebSocket error:', err);
                onError?.('Connection error');
                setState(prev => ({ ...prev, error: 'Connection error', phase: 'idle' }));
            };

            ws.onclose = (event) => {
                console.log('[ElevenLabs] WebSocket closed:', event.code, event.reason);
                wsRef.current = null;

                // Handle Quota Limit (1002) specifically
                if (event.code === 1002 || event.reason.toLowerCase().includes('quota')) {
                    console.warn('[ElevenLabs] Quota exceeded (Handled by Fallback)');
                    // Trigger error so parent can fallback
                    onError?.('ElevenLabs account quota exceeded. Switching to backup...');
                    setState(prev => ({
                        ...prev,
                        isConnected: false,
                        // Force end phase to stop spinner if parent doesn't handle it immediately
                        phase: 'ended',
                        error: 'Quota exceeded'
                    }));
                    return;
                }

                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    phase: prev.phase === 'ready_to_transition' ? 'ready_to_transition' : 'ended',
                }));

                // Cleanup audio
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(track => track.stop());
                    mediaStreamRef.current = null;
                }
            };

        } catch (err: any) {
            console.error('[ElevenLabs] Connection failed:', err);
            onError?.(err.message || 'Connection failed');
            setState(prev => ({ ...prev, error: err.message, phase: 'idle' }));
        }
    }, [userName, handleMessage, setupAudioCapture, onError]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        audioQueueRef.current = [];
        isPlayingRef.current = false;
    }, []);

    // Get result data for saving
    const getResult = useCallback((): WarmUpPhaseResult => {
        return {
            transcript: state.transcript,
            extractedTopic: null, // Will be extracted by LLM on complete
            durationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            conversationId: state.conversationId || '',
        };
    }, [state.transcript, state.conversationId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        ...state,
        connect,
        disconnect,
        getResult,
    };
}
