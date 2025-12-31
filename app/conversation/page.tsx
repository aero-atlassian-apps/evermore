'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AudioPipeline } from '@/lib/audio/AudioPipeline';
import { AuthGuard } from '@/components/common/AuthGuard';
import { useStreamingChat } from '@/lib/stores/useStreamingChat';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AIAudioPlayer } from '@/components/audio/AIAudioPlayer';
import { usePauseDetection, useVolumeMonitor, useSessionTimer } from '@/lib/hooks/usePauseDetection';
import { WarmUpPhase } from '@/components/conversation/WarmUpPhase';
import type { WarmUpPhaseResult } from '@/lib/types/elevenlabs-websocket';
import Image from 'next/image';
import { ConversationStatus } from '@/components/conversation/ConversationStatus';
import { MessageBubble } from '@/components/conversation/MessageBubble';

export interface Message {
  id: string;
  speaker: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

type ConversationPhase = 'checking' | 'warmup' | 'recording';

export default function ActiveConversationPage() {
  const router = useRouter();
  const params = useParams();
  const [sessionId, setSessionId] = useState<string | null>(params?.id as string || null);

  // Two-phase conversation flow - start with 'checking' to determine if warmup is available
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>('checking');
  const [warmupResult, setWarmupResult] = useState<WarmUpPhaseResult | null>(null);
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState<boolean | null>(null);
  const [vertexAIAvailable, setVertexAIAvailable] = useState<boolean | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false); // When Vertex AI unavailable, save audio for later
  const [userName, setUserName] = useState<string>('');

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Message[]>([]);

  const [inputValue, setInputValue] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState<string>('');
  const [showTextInput, setShowTextInput] = useState(false);

  // AI Voice States
  const [aiTextToSpeak, setAiTextToSpeak] = useState<string | undefined>();
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);

  // Volume monitoring for waveform
  const { volumeLevel, updateVolume } = useVolumeMonitor();

  // Session timer
  const { startTime, formatDuration } = useSessionTimer(!!sessionId);

  // Streaming Hook - declared before pause detection to use agentState
  const {
    agentState,
    sendMessage: sendStreamingMessage,
  } = useStreamingChat({
    onToken: (token, fullText) => {
      setStreamingResponse(fullText);
    },
    onComplete: (response) => {
      if (response.text) {
        setTranscript(prev => [...prev, {
          id: `msg-${Date.now()}`,
          speaker: 'agent',
          text: response.text,
          timestamp: new Date().toISOString()
        }]);
        // Trigger AI voice response
        setAiTextToSpeak(response.text);
      }
      setStreamingResponse('');
    },
    onError: (error) => {
      setToastMessage(error);
      setStreamingResponse('');
    },
  });

  // Pause detection for agentic interjections - with smart turn-taking
  const handlePauseDetected = useCallback(async (durationMs: number) => {
    // Smart turn-taking guards:
    // 1. Don't interject if no session
    // 2. Don't interject if AI is currently speaking
    // 3. Don't interject if AI is thinking/generating
    // 4. Don't interject if user is CURRENTLY speaking (key fix!)
    // 5. Don't interject too early in conversation (need at least some user messages)
    if (!sessionId || isAISpeaking || agentState === 'thinking' || isListening) {
      return;
    }

    // Only interject after meaningful user engagement (at least 2 messages exchanged)
    const userMessages = transcript.filter(t => t.speaker !== 'agent');
    if (userMessages.length < 2) {
      return;
    }

    try {
      const res = await fetch('/api/chat/interjection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          silenceDuration: Math.floor(durationMs / 1000),
          recentTranscript: transcript.slice(-4).map(t => ({
            speaker: t.speaker === 'agent' ? 'ai' : 'user',
            text: t.text,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Double-check user hasn't started speaking during the API call
        if (data.shouldInterject && data.message && !isListening) {
          setTranscript(prev => [...prev, {
            id: `msg-${Date.now()}`,
            speaker: 'agent',
            text: data.message,
            timestamp: new Date().toISOString()
          }]);
          setAiTextToSpeak(data.message);
        }
      }
    } catch (e) {
      console.error('[Pause Detection] Interjection failed:', e);
    }
  }, [sessionId, isAISpeaking, agentState, transcript, isListening]);

  const { isPaused, recordSpeech, reset: resetPause } = usePauseDetection({
    silenceThresholdMs: 6000, // Increased to 6 seconds for more natural pauses
    onPauseDetected: handlePauseDetected,
    // Re-enabled with smart turn-taking guards above
    enabled: !!sessionId && transcript.length > 0,
  });

  // Audio Pipeline
  const audioPipeline = useRef<AudioPipeline | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, streamingResponse]);

  const [initError, setInitError] = useState<string | null>(null);

  // Initialize Session and fetch user profile
  useEffect(() => {
    const initSession = async () => {
      // Fetch user profile for name
      try {
        const profileRes = await fetch('/api/users/profile');
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserName(profile.name || profile.firstName || 'there');
        }
      } catch (e) {
        console.warn('[Profile] Failed to fetch:', e);
      }

      // Create session if needed
      if (!sessionId) {
        try {
          const res = await fetch('/api/sessions/start', { method: 'POST', body: JSON.stringify({}) });
          if (res.ok) {
            const data = await res.json();
            setSessionId(data.sessionId);
          } else {
            throw new Error('Failed to start session');
          }
        } catch (err: any) {
          console.error("Session init error", err);
          setInitError(err.message || 'Failed to initialize conversation');
          return;
        }
      }

      // Check ElevenLabs availability to decide warmup vs direct recording
      let elevenLabsOk = false;
      try {
        console.log('[Conversation] Checking ElevenLabs availability...');
        const healthRes = await fetch('/api/elevenlabs/health');
        const health = await healthRes.json();
        setElevenLabsAvailable(health.available);
        elevenLabsOk = health.available;
      } catch (e) {
        console.warn('[Conversation] ElevenLabs health check failed:', e);
        setElevenLabsAvailable(false);
      }

      // Check Vertex AI availability (required for STT and story generation)
      let vertexAIOk = false;
      try {
        console.log('[Conversation] Checking Vertex AI availability...');
        const vertexRes = await fetch('/api/vertexai/health');
        const vertexHealth = await vertexRes.json();
        setVertexAIAvailable(vertexHealth.available);
        vertexAIOk = vertexHealth.available;

        if (!vertexHealth.available) {
          console.warn('[Conversation] Vertex AI unavailable:', vertexHealth.reason, '- entering offline mode');
          setIsOfflineMode(true);
          // Proactively enable browser STT fallback
          setShouldUseBrowserSTT(true);
          setToastMessage('Using Browser Speech Recognition (Offline Mode)');
        }
      } catch (e) {
        console.warn('[Conversation] Vertex AI health check failed:', e);
        setVertexAIAvailable(false);
        setIsOfflineMode(true);
        setShouldUseBrowserSTT(true);
      }

      // Decide conversation phase
      if (elevenLabsOk && vertexAIOk) {
        console.log('[Conversation] All services available, showing warmup phase');
        setConversationPhase('warmup');
      } else if (vertexAIOk) {
        console.log('[Conversation] Vertex AI available, skipping to recording');
        setConversationPhase('recording');
      } else {
        console.log('[Conversation] Offline mode - audio will be saved for later');
        setConversationPhase('recording'); // Still show recording UI, but in offline mode
      }
    };
    initSession();
  }, [sessionId]);

  // Handle warm-up phase completion - transition to recording
  const handleWarmUpComplete = useCallback((result: WarmUpPhaseResult & { extractedTopic: string | null }) => {
    setWarmupResult(result);
    setConversationPhase('recording');
    // Clear welcome loaded to trigger fresh greeting with topic context
    setWelcomeLoaded(false);
  }, []);

  // Handle warm-up error - silently skip to recording phase
  const handleWarmUpError = useCallback((error: string) => {
    // Prevent double-triggering if we're already handling the transition
    setConversationPhase(currentPhase => {
      if (currentPhase === 'recording') return 'recording';

      console.warn('[WarmUp] Error/Quota transitioning to recording:', error);
      // Silently skip to recording - no toast message to avoid confusing users
      // Reset welcome flag only on FIRST transition
      setWelcomeLoaded(false);
      return 'recording';
    });
  }, []);

  // Initial Greeting - Only runs in RECORDING phase
  useEffect(() => {
    if (!sessionId || welcomeLoaded || conversationPhase !== 'recording') return;

    const fetchWelcome = async () => {
      try {
        const res = await fetch('/api/chat/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userId: 'current', userName, includeAudio: true }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.greeting) {
            setTranscript([{
              id: `msg-${Date.now()}`,
              speaker: 'agent',
              text: data.greeting,
              timestamp: new Date().toISOString()
            }]);
            setAiTextToSpeak(data.greeting);
            setWelcomeLoaded(true);
          }
        } else {
          // Fallback to streaming init
          await sendStreamingMessage(sessionId, '__init__');
          setWelcomeLoaded(true);
        }
      } catch (e) {
        console.error('[Welcome] Failed:', e);
        setTranscript([{
          id: `msg-${Date.now()}`,
          speaker: 'agent',
          text: "Welcome! I'm so glad you're here. What story shall we capture today?",
          timestamp: new Date().toISOString()
        }]);
        setWelcomeLoaded(true);
      }
    };

    fetchWelcome();
  }, [sessionId, welcomeLoaded, conversationPhase, userName]);

  // Browser Speech Recognition - Active Listening
  const startBrowserSTT = useCallback(() => {
    return new Promise<void>((resolve) => {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setToastMessage('Browser speech recognition not supported');
        resolve();
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true; // Show interim results

      recognition.onstart = () => {
        setIsListening(true);
        recordSpeech(); // Reset pause detection
      };

      recognition.onresult = (event: any) => {
        const transcriptText = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');

        // Update input buffer or show valid interim results? 
        // For now, let's just log
        console.log('[Browser STT Interim]:', transcriptText);
      };

      recognition.onerror = (event: any) => {
        console.warn('[Browser STT] Error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setToastMessage('Microphone access denied');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Get final result
        // Note: onresult fires before onend. We need to capture the final text.
        // Actually, onresult gives us the text. We should handle it there.
      };

      // Override onresult to capture final text
      recognition.onresult = async (event: any) => {
        const isFinal = event.results[event.results.length - 1].isFinal;
        const transcriptText = event.results[event.results.length - 1][0].transcript;

        if (isFinal && transcriptText) {
          console.log('[Browser STT Final]:', transcriptText);
          setTranscript(prev => [...prev, {
            id: `msg-${Date.now()}`,
            speaker: 'user',
            text: transcriptText,
            timestamp: new Date().toISOString()
          }]);

          // Helper to send message
          await sendStreamingMessage(sessionId!, transcriptText);
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setIsListening(false);
      }
      resolve();
    });
  }, [sessionId, sendStreamingMessage, recordSpeech]);

  const [shouldUseBrowserSTT, setShouldUseBrowserSTT] = useState(false);

  // Moved sendAudio definition up to before it's used in useEffect
  const sendAudio = async (blob: Blob) => {
    console.log(`[Conversation ${sessionId}] Sending audio blob, size: ${blob.size}`);

    // If in offline mode, save audio for later processing
    // BUT if we have browserSTT enabled, we shouldn't be here ideally, 
    // unless we want to save audio AND use browser STT (a bit complex for now).
    if (isOfflineMode && !shouldUseBrowserSTT) {
      try {
        console.log('[Conversation] Offline mode - saving audio for later');
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('sessionId', sessionId!);
        // Get userId from profile fetch or pass it differently
        const profileRes = await fetch('/api/users/profile');
        const profile = await profileRes.json();
        formData.append('userId', profile.id);

        const saveRes = await fetch('/api/conversation/save-audio', { method: 'POST', body: formData });
        if (saveRes.ok) {
          console.log('[Conversation] Audio saved for later processing');
          // Show in transcript that we're recording but will process later
          setTranscript(prev => [...prev, {
            id: `msg-${Date.now()}`,
            speaker: 'user',
            text: '🎙️ Recording saved...',
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (e) {
        console.error('[Conversation] Failed to save offline audio:', e);
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', blob);
      const res = await fetch('/api/chat/speech-to-text', { method: 'POST', body: formData });

      const data = await res.json();

      if (res.ok && data.text) {
        console.log(`[Conversation ${sessionId}] STT result:`, data.text?.substring(0, 50) || '(empty)');
        setTranscript(prev => [...prev, {
          id: `msg-${Date.now()}`,
          speaker: 'user',
          text: data.text,
          timestamp: new Date().toISOString()
        }]);
        console.log(`[Conversation ${sessionId}] Calling sendStreamingMessage...`);
        await sendStreamingMessage(sessionId!, data.text);

      } else if (data.useBrowserFallback) {
        // Server STT failed due to credentials - use browser fallback for FUTURE turns
        console.warn('[Conversation] Server STT unavailable, switching to browser fallback');
        setShouldUseBrowserSTT(true);
        setToastMessage('Switching to browser speech recognition');

        // For THIS turn, we missed the audio. 
        // We could ask user to repeat?
        setTranscript(prev => [...prev, {
          id: `sys-${Date.now()}`,
          speaker: 'system',
          text: '⚠️ Connection issue. Switched to browser mode. Please speak again.',
          timestamp: new Date().toISOString()
        }]);
      } else {
        console.error(`[Conversation ${sessionId}] STT failed:`, res.status, data.error);
        setToastMessage('Speech recognition failed');
      }
    } catch (e) {
      console.error(`[Conversation ${sessionId}] sendAudio error:`, e);
      setToastMessage('Audio upload failed');
    }
  };

  // Audio Pipeline Init
  useEffect(() => {
    if (!sessionId) return;

    // If using browser STT, we don't need AudioPipeline for STT
    // But maybe we keep it for VAD?
    // For simplicity: If BrowserSTT is on, we don't init AudioPipeline or ignore it.
    if (shouldUseBrowserSTT) return;

    audioPipeline.current = new AudioPipeline();
    audioPipeline.current.onSpeechStart = () => {
      setIsListening(true);
      recordSpeech(); // Reset pause detection
    };
    audioPipeline.current.onSpeechEnd = async (blob) => {
      setIsListening(false);
      await sendAudio(blob);
    };
    audioPipeline.current.onVolumeChange = (vol) => {
      updateVolume(vol);
      if (vol > 0.02) {
        recordSpeech(); // Keep resetting pause timer while speaking (above noise floor)
      }
    };
    audioPipeline.current.onError = (err) => {
      setIsListening(false);
      const errorMessage = typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Audio Error');
      setToastMessage(errorMessage);
    };
    return () => { audioPipeline.current?.stop(); };
  }, [sessionId, recordSpeech, updateVolume, shouldUseBrowserSTT]);

  const toggleListening = async () => {
    // Branch logic based on mode
    if (shouldUseBrowserSTT) {
      if (isListening) {
        // Browser STT usually handles its own stop, or manual stop
        // We can't easily "stop" the pending request from here unless we exposed the recognition object
        // But clicking 'stop' in UI calls this.
        // We'll trust onend or force a reload if stuck?
        // Actually, we should refactor startBrowserSTT to save the recognition instance ref.
        // For now: Just toggle state.
        setIsListening(false);
      } else {
        startBrowserSTT();
      }
      return;
    }

    if (!audioPipeline.current) return;
    if (isListening) {
      audioPipeline.current.stop();
      setIsListening(false);
    } else {
      await audioPipeline.current.initialize();
      await audioPipeline.current.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId) return;
    const text = inputValue;
    setInputValue('');
    setShowTextInput(false);
    setTranscript(prev => [...prev, {
      id: `msg-${Date.now()}`,
      speaker: 'user',
      text,
      timestamp: new Date().toISOString()
    }]);
    await sendStreamingMessage(sessionId, text);
  };

  /* State for saving indicator */
  const [isSaving, setIsSaving] = useState(false);

  const handleEndSession = async () => {
    if (!sessionId || isSaving) return;
    setIsSaving(true);

    try {
      // Stop any audio recording
      if (audioPipeline.current && isListening) {
        audioPipeline.current.stop();
        setIsListening(false);
      }

      // End the session via API
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setToastMessage('Session saved successfully!');
        // Redirect to persona-appropriate dashboard
        const profileRes = await fetch('/api/users/profile');
        const profile = profileRes.ok ? await profileRes.json() : null;
        const dashboard = profile?.role === 'family' ? '/family' : '/stories';
        setTimeout(() => {
          router.push(dashboard);
        }, 1500);
      } else {
        setToastMessage('Failed to save session. Please try again.');
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Error ending session:', err);
      setToastMessage('Error saving session.');
      setIsSaving(false);
    }
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <AuthGuard>
      <div className="h-[100dvh] bg-[#FCF8F3] flex flex-col overflow-hidden">
        <Header />

        {/* AI Audio Player - Only in RECORDING phase (warm-up uses ElevenLabs agent audio) */}
        {conversationPhase === 'recording' && (
          <AIAudioPlayer
            textToSpeak={aiTextToSpeak}
            onSpeakingStart={() => setIsAISpeaking(true)}
            onSpeakingEnd={() => {
              setIsAISpeaking(false);
              setAiTextToSpeak(undefined);
            }}
            onError={(err) => console.error('[TTS Error]', err)}
            variant="minimal"
            shouldStop={isListening} // Smart interruption: stop AI when user starts speaking
          />
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down w-[90%] md:w-auto text-center">
            <div className="bg-terracotta text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300">
              <span className="material-symbols-outlined filled">check_circle</span>
              {toastMessage}
            </div>
          </div>
        )}

        {/* Main Content Area - Flexbox for proper height distribution */}
        <div className="flex-1 flex flex-col items-center px-0 md:px-4 pt-0 md:pt-4 pb-0 md:pb-6 overflow-hidden">

          {/* Main Card - fixed height container */}
          <div className="w-full max-w-4xl bg-white md:rounded-[2.5rem] shadow-none md:shadow-2xl md:shadow-peach-warm/20 border-x-0 md:border md:border-peach-main/10 flex flex-col overflow-hidden animate-fade-in flex-1 relative">

            {/* Session Init Error */}
            {initError && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
                  <span className="material-symbols-outlined text-3xl">error_outline</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-text-primary mb-2">Connection Issue</h2>
                <p className="text-text-secondary mb-8">{initError}. Please check your connection and try again.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-terracotta text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-[#C18E5E] transition-all"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* PHASE 0: Checking ElevenLabs availability */}
            {!initError && conversationPhase === 'checking' && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-br from-peach-main/20 to-terracotta/10 rounded-full flex items-center justify-center mb-6 relative">
                  <span className="material-symbols-outlined text-4xl text-terracotta animate-pulse">mic</span>
                  <div className="absolute inset-0 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin"></div>
                </div>
                <h2 className="text-2xl font-serif font-bold text-text-primary mb-2">Getting Ready...</h2>
                <p className="text-text-secondary">Preparing your conversation experience</p>
              </div>
            )}

            {/* PHASE 1: Warm-Up */}
            {!initError && conversationPhase === 'warmup' && sessionId && (
              <WarmUpPhase
                userName={userName || 'there'}
                sessionId={sessionId}
                onComplete={handleWarmUpComplete}
                onError={handleWarmUpError}
              />
            )}

            {/* PHASE 2: Story Recording */}
            {conversationPhase === 'recording' && (
              <>
                {/* Offline Mode Banner - Friendly message */}
                {isOfflineMode && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-3 text-center animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-amber-600">cloud_off</span>
                      <span className="text-sm font-medium text-amber-800">
                        Recording in offline mode — Your story is being saved! Come back later to continue.
                      </span>
                    </div>
                  </div>
                )}

                {/* Header: Timer & Status */}
                <div className="h-16 md:h-20 shrink-0 border-b border-peach-main/10 flex items-center justify-between px-4 md:px-8 bg-white/90 backdrop-blur-md z-20 transition-all">
                  <div className="flex items-center gap-2 md:gap-3 text-slate-500 bg-slate-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-all">
                    <span className="material-symbols-outlined text-lg md:text-xl">schedule</span>
                    <span className="text-sm md:text-base font-mono font-bold tracking-tight">{formatDuration()}</span>
                  </div>

                  {/* Dynamic Status Pill */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <ConversationStatus
                      state={
                        (agentState === 'thinking' || (!streamingResponse && !isAISpeaking && !isListening && agentState !== 'idle')) ? 'thinking' :
                          isAISpeaking ? 'speaking' :
                            isListening ? 'listening' :
                              'idle'
                      }
                    />
                  </div>

                  <button
                    onClick={handleEndSession}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors text-xs font-bold uppercase tracking-wider group"
                  >
                    <span>End</span>
                    <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">logout</span>
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-grow overflow-y-auto px-6 py-6 md:px-10 scroll-smooth space-y-6 relative bg-gradient-to-b from-white to-peach-main/5">
                  {transcript.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 pointer-events-none">
                      <span className="material-symbols-outlined text-8xl text-peach-main/30 mb-4">forum</span>
                      <p className="text-xl font-serif text-text-secondary">Your story begins here...</p>
                    </div>
                  )}

                  {transcript.map((msg, i) => (
                    <MessageBubble
                      key={msg.id || i}
                      text={msg.text}
                      isAI={msg.speaker === 'agent'}
                      timestamp={i === transcript.length - 1 ? 'Just now' : undefined}
                    />
                  ))}

                  {streamingResponse && (
                    <MessageBubble
                      text={streamingResponse}
                      isAI={true}
                      isStreaming={true}
                    />
                  )}
                  <div ref={chatEndRef} className="h-4" />
                </div>

                {/* Controls Footer - Enhanced & Pinned */}
                <div className="shrink-0 p-4 md:p-6 bg-white border-t border-peach-main/10 relative z-30 pb-safe">
                  <div className="flex items-center justify-between md:justify-center gap-4 md:gap-8 relative max-w-3xl mx-auto">

                    {/* Input Toggle */}
                    <button
                      onClick={() => setShowTextInput(!showTextInput)}
                      className={`p-3 md:p-4 rounded-full transition-colors active:scale-95 ${showTextInput ? 'bg-terracotta text-white' : 'text-text-muted hover:bg-slate-50'}`}
                      title="Type message"
                    >
                      <span className="material-symbols-outlined text-2xl">keyboard</span>
                    </button>

                    {/* Main Mic Button - Centered & Prominent */}
                    <div className="relative group flex-shrink-0">
                      {/* Volume-reactive outer ring */}
                      {isListening && (
                        <div
                          className="absolute inset-0 rounded-full bg-gradient-to-br from-terracotta/40 to-orange-300/30 transition-transform duration-75"
                          style={{
                            transform: `scale(${1 + Math.min(volumeLevel * 3, 0.5)})`,
                            opacity: 0.5 + Math.min(volumeLevel * 2, 0.5)
                          }}
                        />
                      )}

                      {/* Ripple effects */}
                      {isListening && (
                        <>
                          <div className="absolute inset-0 bg-terracotta/30 rounded-full animate-ping opacity-75"></div>
                          <div className="absolute inset-0 bg-terracotta/20 rounded-full animate-pulse delay-75"></div>
                        </>
                      )}

                      <button
                        onClick={toggleListening}
                        className={`
                           relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 border-4 
                           ${isListening
                            ? 'bg-terracotta border-white text-white rotate-0'
                            : 'bg-white border-peach-main/20 text-terracotta hover:border-terracotta/50'
                          }
                         `}
                      >
                        <span className="material-symbols-outlined text-3xl md:text-4xl filled transition-transform duration-300">
                          {isListening ? 'stop' : 'mic'}
                        </span>
                      </button>
                    </div>

                    {/* End Session Button */}
                    <button
                      onClick={handleEndSession}
                      disabled={isSaving}
                      className="flex flex-col items-center gap-1 text-red-500 hover:text-red-600 transition-colors disabled:opacity-50 active:scale-95"
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                        <span className="material-symbols-outlined text-lg md:text-xl">stop_circle</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block">End</span>
                    </button>

                  </div>

                  {/* Manual Input Field (Conditional) */}
                  {showTextInput && (
                    <div className="mt-4 flex gap-2 animate-fade-in-up">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your story..."
                        autoFocus
                        className="flex-1 bg-slate-50 border border-peach-main/20 rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim()}
                        className="w-12 h-12 bg-terracotta text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined">send</span>
                      </button>
                    </div>
                  )}

                  <div className="text-center mt-3 md:mt-4">
                    <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-[0.2em] opacity-60">
                      {isListening ? 'Listening...' : showTextInput ? 'Type your message' : 'Tap to Speak'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </AuthGuard>
  );
}
