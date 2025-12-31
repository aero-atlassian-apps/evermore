'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface AIAudioPlayerProps {
    /** When true, makes a TTS request for the given text */
    textToSpeak?: string;
    /** Called when audio starts playing */
    onSpeakingStart?: () => void;
    /** Called when audio finishes playing */
    onSpeakingEnd?: () => void;
    /** Called on error */
    onError?: (error: Error) => void;
    /** Visual style variant */
    variant?: 'minimal' | 'waveform';
    /** If true, immediately stops any playing audio (for interruption handling) */
    shouldStop?: boolean;
}

/**
 * AIAudioPlayer - Converts AI text responses to speech using ElevenLabs TTS.
 * 
 * Usage:
 * ```tsx
 * <AIAudioPlayer 
 *   textToSpeak={aiResponse} 
 *   onSpeakingStart={() => setIsSpeaking(true)}
 *   onSpeakingEnd={() => setIsSpeaking(false)}
 *   shouldStop={userStartedSpeaking}
 * />
 * ```
 */
export function AIAudioPlayer({
    textToSpeak,
    onSpeakingStart,
    onSpeakingEnd,
    onError,
    variant = 'minimal',
    shouldStop = false
}: AIAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastSpokenText, setLastSpokenText] = useState<string>('');

    // Handle interruption - stop audio immediately when shouldStop becomes true
    useEffect(() => {
        if (shouldStop && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            // Note: onSpeakingEnd is called via the onPause handler below
        }
    }, [shouldStop]);

    // Speak new text when textToSpeak changes
    useEffect(() => {
        // Prevent unwanted re-triggering or loops
        if (!textToSpeak || textToSpeak === lastSpokenText || textToSpeak.trim().length === 0) {
            return;
        }

        const speak = async () => {
            // Stop any currently playing audio first to prevent overlap
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                // Small delay to ensure clean audio transition
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setIsLoading(true);
            try {
                const response = await fetch('/api/chat/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textToSpeak })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));

                    // If server says to use browser fallback, use Web Speech API
                    if (errorData.useBrowserFallback && 'speechSynthesis' in window) {
                        console.log('[AIAudioPlayer] Using browser Web Speech fallback');
                        const utterance = new SpeechSynthesisUtterance(textToSpeak);
                        utterance.rate = 0.9;
                        utterance.pitch = 1.0;

                        // Get a friendly voice
                        const voices = window.speechSynthesis.getVoices();
                        const preferredVoice = voices.find(v =>
                            v.name.includes('Google') || v.name.includes('Microsoft') || v.lang.startsWith('en')
                        );
                        if (preferredVoice) utterance.voice = preferredVoice;

                        utterance.onstart = () => {
                            setIsPlaying(true);
                            onSpeakingStart?.();
                        };
                        utterance.onend = () => {
                            setIsPlaying(false);
                            onSpeakingEnd?.();
                        };
                        utterance.onerror = () => {
                            setIsPlaying(false);
                            onSpeakingEnd?.();
                        };

                        window.speechSynthesis.speak(utterance);
                        setLastSpokenText(textToSpeak || '');
                        setIsLoading(false);
                        return;
                    }

                    throw new Error(errorData.error || 'TTS request failed');
                }

                // Create audio blob from response
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                if (audioRef.current) {
                    // Clean up previous audio URL
                    if (audioRef.current.src) {
                        URL.revokeObjectURL(audioRef.current.src);
                    }

                    audioRef.current.src = audioUrl;
                    // Ensure we start from the beginning
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => {
                        // Ignore AbortError as it simply means playback was interrupted/superseded
                        if (e.name !== 'AbortError') {
                            console.warn('[AIAudioPlayer] Playback failed:', e);
                        }
                    });
                    setLastSpokenText(textToSpeak || '');
                }
            } catch (err) {
                console.error('[AIAudioPlayer] TTS failed:', err);

                // Last resort: try browser Web Speech as fallback
                if ('speechSynthesis' in window && textToSpeak) {
                    console.log('[AIAudioPlayer] Attempting Web Speech fallback after error');
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.rate = 0.9;
                    utterance.onstart = () => { setIsPlaying(true); onSpeakingStart?.(); };
                    utterance.onend = () => { setIsPlaying(false); onSpeakingEnd?.(); };
                    window.speechSynthesis.speak(utterance);
                } else {
                    onError?.(err instanceof Error ? err : new Error(String(err)));
                }

                // Mark as spoken/attempted to prevent infinite retry loop
                setLastSpokenText(textToSpeak || '');
            } finally {
                setIsLoading(false);
            }
        };

        speak();
    }, [textToSpeak, lastSpokenText, onError]);

    // Handle audio events
    const handlePlay = useCallback(() => {
        setIsPlaying(true);
        onSpeakingStart?.();
    }, [onSpeakingStart]);

    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        onSpeakingEnd?.();
    }, [onSpeakingEnd]);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current?.src) {
                URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, []);

    return (
        <div className="ai-audio-player">
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                onPlay={handlePlay}
                onEnded={handleEnded}
                onPause={handlePause}
                onError={(e) => onError?.(new Error('Audio playback failed'))}
            />

            {/* Visual indicator */}
            {variant === 'waveform' && (isPlaying || isLoading) && (
                <div className="ai-speaking-indicator">
                    {isLoading ? (
                        <span className="loading-dots">
                            <span>●</span><span>●</span><span>●</span>
                        </span>
                    ) : (
                        <div className="waveform">
                            <span className="bar"></span>
                            <span className="bar"></span>
                            <span className="bar"></span>
                            <span className="bar"></span>
                            <span className="bar"></span>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .ai-audio-player {
                    display: inline-flex;
                    align-items: center;
                }
                
                .ai-speaking-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    border-radius: 20px;
                    color: white;
                }
                
                .loading-dots span {
                    animation: pulse 1.4s infinite both;
                    opacity: 0.3;
                }
                .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
                .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
                
                @keyframes pulse {
                    0%, 80%, 100% { opacity: 0.3; }
                    40% { opacity: 1; }
                }
                
                .waveform {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    height: 20px;
                }
                
                .waveform .bar {
                    width: 4px;
                    background: white;
                    border-radius: 2px;
                    animation: waveform 0.8s infinite ease-in-out;
                }
                .waveform .bar:nth-child(1) { animation-delay: 0s; height: 8px; }
                .waveform .bar:nth-child(2) { animation-delay: 0.1s; height: 16px; }
                .waveform .bar:nth-child(3) { animation-delay: 0.2s; height: 12px; }
                .waveform .bar:nth-child(4) { animation-delay: 0.3s; height: 18px; }
                .waveform .bar:nth-child(5) { animation-delay: 0.4s; height: 10px; }
                
                @keyframes waveform {
                    0%, 100% { transform: scaleY(0.5); }
                    50% { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}

/**
 * Hook for programmatically controlling TTS playback
 */
export function useAIVoice() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [textToSpeak, setTextToSpeak] = useState<string | undefined>();

    const speak = useCallback((text: string) => {
        setTextToSpeak(text);
    }, []);

    const stop = useCallback(() => {
        setTextToSpeak(undefined);
    }, []);

    return {
        isSpeaking,
        textToSpeak,
        speak,
        stop,
        onSpeakingStart: () => setIsSpeaking(true),
        onSpeakingEnd: () => setIsSpeaking(false),
    };
}
