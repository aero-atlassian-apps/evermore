'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
    text: string;
    onPlayingChange?: (isPlaying: boolean) => void;
    className?: string;
    autoPlay?: boolean;
}

/**
 * AudioPlayer Component - Premium TTS with graceful fallback
 * 
 * Strategy: ElevenLabs → Vertex AI → Web Speech API
 * All transitions are seamless - user never sees errors
 */
export function AudioPlayer({ text, onPlayingChange, className = '', autoPlay = false }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [usingFallback, setUsingFallback] = useState(false);
    const [volume, setVolume] = useState(1.0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioUrlRef = useRef<string | null>(null);

    // Cleanup function - declare before useEffects that reference it
    const cleanup = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }, []);

    // Initialize browser speech synthesis
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
        }
        return () => {
            cleanup();
        };
    }, [cleanup]);

    // Cleanup audio when text changes (page navigation) - stops audio on page change
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [text, cleanup]);

    // Try server-side TTS (ElevenLabs → Vertex AI)
    const tryServerTTS = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text.substring(0, 5000) })
            });

            if (!response.ok) {
                // Always fall back to browser speech on any server error
                console.log('[AudioPlayer] Server TTS failed, using browser fallback');
                return false;
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            audioUrlRef.current = audioUrl;

            const audio = new Audio(audioUrl);
            audio.volume = volume;
            audioRef.current = audio;

            return new Promise((resolve) => {
                audio.oncanplaythrough = () => {
                    audio.play().then(() => {
                        setIsPlaying(true);
                        setUsingFallback(false);
                        onPlayingChange?.(true);

                        // Track progress
                        const duration = audio.duration || text.length / 15;
                        progressIntervalRef.current = setInterval(() => {
                            if (audio.currentTime && audio.duration) {
                                setProgress((audio.currentTime / audio.duration) * 100);
                            }
                        }, 100);

                        audio.onended = () => {
                            setIsPlaying(false);
                            setProgress(100);
                            onPlayingChange?.(false);
                            cleanup();
                        };

                        resolve(true);
                    }).catch(() => resolve(false));
                };

                audio.onerror = () => resolve(false);
                audio.load();
            });
        } catch (err) {
            console.warn('[AudioPlayer] Server TTS failed:', err);
            return false;
        }
    }, [text, volume, onPlayingChange, cleanup]);

    // Fallback to Web Speech API
    const triggerBrowserTTS = useCallback(() => {
        console.log('[AudioPlayer] Attempting browser TTS fallback');

        // Ensure speech synthesis is available
        if (!synthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
        }

        if (!synthRef.current) {
            console.error('[AudioPlayer] Browser speech synthesis not available');
            return false;
        }

        console.log('[AudioPlayer] Browser TTS initialized, speaking...');

        // Cancel any pending speech first
        synthRef.current.cancel();

        setUsingFallback(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Get a friendly voice
        const voices = synthRef.current.getVoices();
        console.log('[AudioPlayer] Available voices:', voices.length);
        const friendlyVoice = voices.find(v =>
            v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha'))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (friendlyVoice) {
            utterance.voice = friendlyVoice;
            console.log('[AudioPlayer] Using voice:', friendlyVoice.name);
        }

        // Slower, warmer pace for storytelling
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = volume;

        utterance.onstart = () => {
            console.log('[AudioPlayer] Browser TTS started speaking');
            setIsPlaying(true);
            onPlayingChange?.(true);
        };

        utterance.onend = () => {
            setIsPlaying(false);
            setProgress(100);
            onPlayingChange?.(false);
            setTimeout(() => setProgress(0), 1000);
        };

        utterance.onerror = (e) => {
            // Ignore interruption/cancellation errors as they are expected during cleanup
            if (e.error === 'interrupted' || e.error === 'canceled') {
                console.log('[AudioPlayer] Browser TTS interrupted (normal cleanup)');
                return;
            }
            console.error('[AudioPlayer] Browser TTS error:', e.error, e);
            setIsPlaying(false);
            onPlayingChange?.(false);
        };

        // Estimate progress
        const words = text.split(/\s+/).length;
        const estimatedMs = words * 400;
        let elapsed = 0;
        progressIntervalRef.current = setInterval(() => {
            elapsed += 100;
            setProgress(Math.min((elapsed / estimatedMs) * 100, 99));
            if (!synthRef.current?.speaking) {
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
        }, 100);

        synthRef.current.speak(utterance);
        console.log('[AudioPlayer] Browser TTS speak() called');
        return true;
    }, [text, volume, onPlayingChange]);

    const handlePlay = useCallback(async () => {
        if (isPlaying) return;

        cleanup();
        setIsLoading(true);
        setProgress(0);

        try {
            // Try server TTS first (ElevenLabs → Vertex AI)
            const serverSuccess = await tryServerTTS();

            if (!serverSuccess) {
                // Gracefully fall back to Web Speech
                triggerBrowserTTS();
            }
        } catch (err) {
            // If anything fails, always try browser TTS
            console.warn('[AudioPlayer] Error in TTS flow, using browser fallback:', err);
            triggerBrowserTTS();
        }

        setIsLoading(false);
    }, [isPlaying, cleanup, tryServerTTS, triggerBrowserTTS]);

    useEffect(() => {
        let mounted = true;

        if (autoPlay && text && !isPlaying && !isLoading && mounted) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            handlePlay();
        }

        return () => {
            mounted = false;
        };
    }, [autoPlay, text, isPlaying, isLoading, handlePlay]);

    const handlePause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
                onPlayingChange?.(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
                onPlayingChange?.(true);
            }
        } else if (synthRef.current) {
            if (isPlaying) {
                synthRef.current.pause();
                setIsPlaying(false);
                onPlayingChange?.(false);
            } else {
                synthRef.current.resume();
                setIsPlaying(true);
                onPlayingChange?.(true);
            }
        }
    };

    const handleStop = () => {
        cleanup();
        setIsPlaying(false);
        setProgress(0);
        onPlayingChange?.(false);
    };

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Play/Pause Button with loading state */}
            <button
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={isLoading}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
                    ${isLoading
                        ? 'bg-amber-200 animate-pulse'
                        : 'bg-gradient-to-r from-amber-400 to-orange-400 hover:opacity-90 active:scale-95'
                    }
                    text-white
                `}
            >
                {isLoading ? (
                    <span className="material-symbols-outlined animate-spin text-amber-600">progress_activity</span>
                ) : (
                    <span className="material-symbols-outlined">
                        {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                )}
            </button>

            {/* Progress Bar with smooth animation */}
            <div className="flex-1 h-1.5 bg-amber-200/50 rounded-full overflow-hidden relative">
                <div
                    className={`
                        h-full rounded-full transition-all duration-200 ease-out
                        ${usingFallback
                            ? 'bg-amber-400'
                            : 'bg-gradient-to-r from-amber-400 to-orange-400'
                        }
                    `}
                    style={{ width: `${progress}%` }}
                />
                {isLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent animate-shimmer" />
                )}
            </div>

            {/* Stop Button */}
            {isPlaying && (
                <button
                    onClick={handleStop}
                    className="w-8 h-8 rounded-full bg-white/80 text-amber-700 flex items-center justify-center hover:bg-white transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">stop</span>
                </button>
            )}

            {/* Volume Control (Compact) */}
            <div className={`flex items-center gap-1 transition-all duration-300 ${isPlaying ? 'w-24 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                <button
                    onClick={() => setVolume(v => v === 0 ? 1 : 0)}
                    className="text-amber-700/70 hover:text-amber-700"
                >
                    <span className="material-symbols-outlined text-lg">
                        {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                    </span>
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                        const newVol = parseFloat(e.target.value);
                        setVolume(newVol);
                        if (audioRef.current) audioRef.current.volume = newVol;
                        if (synthRef.current && isPlaying) {
                            // Resume/Restart might be needed for SpeechSynthesis volume to update in some browsers, 
                            // but usually next utterance picks it up. 
                            // For currently playing utterance, it's tricky.
                            // We heavily rely on ref update for next play.
                        }
                    }}
                    className="w-16 h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
            </div>

            {/* Listen Label - subtle quality indicator */}
            {!isPlaying && progress === 0 && !isLoading && (
                <span className="text-xs font-bold text-amber-700/70 uppercase tracking-wider">
                    Listen
                </span>
            )}

            {/* Shimmer animation style */}
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 1.5s infinite;
                }
            `}</style>
        </div>
    );
}
