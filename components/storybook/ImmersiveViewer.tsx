'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Scene {
    pageNumber: number;
    text: string;
    generatedImageUrl?: string;
}

interface ImmersiveViewerProps {
    scenes: Scene[];
    title: string;
    onExit: () => void;
    startPage?: number;
}

/**
 * ImmersiveViewer Component
 * 
 * Full-screen immersive storybook experience with:
 * - Auto-advance synced to narration
 * - Ambient background
 * - Keyboard shortcuts
 */
export function ImmersiveViewer({ scenes, title, onExit, startPage = 0 }: ImmersiveViewerProps) {
    const [currentPage, setCurrentPage] = useState(startPage);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const lastSpokenPageRef = useRef<number>(-1);

    const currentScene = scenes[currentPage];

    // Audio refs
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Enter fullscreen
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Load voices for fallback
            if ('speechSynthesis' in window) {
                synthRef.current = window.speechSynthesis;
                const loadVoices = () => {
                    const availableVoices = window.speechSynthesis.getVoices();
                    if (availableVoices.length > 0) setVoices(availableVoices);
                };
                loadVoices();
                window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
            }

            document.documentElement.requestFullscreen?.().catch(() => { });

            return () => {
                synthRef.current?.cancel();
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                document.exitFullscreen?.().catch(() => { });
            };
        }
    }, []);

    // Helper: Browser TTS Fallback
    const fallbackToBrowserTTS = useCallback((text: string, pageIndex: number) => {
        if (!synthRef.current) return;

        console.log('[ImmersiveViewer] Using Browser TTS fallback');
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        const availableVoices = voices.length > 0 ? voices : synthRef.current.getVoices();
        const friendlyVoice = availableVoices.find(v =>
            v.lang.startsWith('en') && (
                v.name.includes('Google') ||
                v.name.includes('Microsoft') ||
                v.name.includes('Samantha')
            )
        ) || availableVoices.find(v => v.lang.startsWith('en'));

        if (friendlyVoice) utterance.voice = friendlyVoice;
        utterance.rate = 0.9;

        utterance.onend = () => {
            if (pageIndex < scenes.length - 1 && !isPaused) {
                setTimeout(() => setCurrentPage(p => p + 1), 1000);
            } else if (pageIndex >= scenes.length - 1) {
                setIsPlaying(false);
            }
        };

        utterance.onerror = () => setIsPlaying(false);
        synthRef.current.speak(utterance);
    }, [scenes, isPaused, voices]);

    const speakPage = useCallback(async (pageIndex: number) => {
        // cleanup previous audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (synthRef.current) synthRef.current.cancel();

        const scene = scenes[pageIndex];
        if (!scene) return;

        console.log('[ImmersiveViewer] Fetching premium audio for page', pageIndex);

        try {
            // Try Server TTS (ElevenLabs)
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: scene.text })
            });

            if (!response.ok) throw new Error('TTS API failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                if (pageIndex < scenes.length - 1 && !isPaused) {
                    setTimeout(() => setCurrentPage(p => p + 1), 1000);
                } else if (pageIndex >= scenes.length - 1) {
                    setIsPlaying(false);
                }
            };

            audio.onerror = () => {
                console.warn('[ImmersiveViewer] Audio playback failed, falling back');
                fallbackToBrowserTTS(scene.text, pageIndex);
            };

            await audio.play();

        } catch (err) {
            console.warn('[ImmersiveViewer] Premium TTS failed, using fallback:', err);
            fallbackToBrowserTTS(scene.text, pageIndex);
        }
    }, [scenes, isPaused, fallbackToBrowserTTS]);

    // Auto-play when page changes and we are "playing"
    useEffect(() => {
        if (isPlaying && !isPaused) {
            speakPage(currentPage);
        }
    }, [currentPage, isPlaying, isPaused, speakPage]);

    const handlePlay = () => {
        setIsPlaying(true);
        setIsPaused(false);
        speakPage(currentPage);
    };

    const handlePause = () => {
        if (audioRef.current) {
            if (isPaused) {
                audioRef.current.play();
                setIsPaused(false);
            } else {
                audioRef.current.pause();
                setIsPaused(true);
            }
        } else if (synthRef.current) {
            if (isPaused) {
                synthRef.current.resume();
                setIsPaused(false);
            } else {
                synthRef.current.pause();
                setIsPaused(true);
            }
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        synthRef.current?.cancel();
        setIsPlaying(false);
        setIsPaused(false);
    };

    const goToPage = (page: number) => {
        if (page < 0 || page >= scenes.length) return;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        synthRef.current?.cancel();

        setCurrentPage(page);
        if (isPlaying && !isPaused) {
            speakPage(page);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (!isPlaying) handlePlay();
                    else handlePause();
                    break;
                case 'ArrowRight':
                    goToPage(currentPage + 1);
                    break;
                case 'ArrowLeft':
                    goToPage(currentPage - 1);
                    break;
                case 'Escape':
                    handleStop();
                    onExit();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, isPlaying, isPaused]);

    return (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-amber-900 via-orange-900 to-yellow-900">
            {/* Ambient overlay */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 pointer-events-none" />

            {/* Main content */}
            <div className="h-full flex flex-col">
                {/* Minimal Header */}
                <header className="h-12 flex items-center justify-between px-6 text-white/70">
                    <button onClick={onExit} className="flex items-center gap-2 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                        <span className="text-sm font-bold">Exit</span>
                    </button>
                    <span className="text-sm font-serif">{title}</span>
                    <span className="text-sm">
                        {currentPage + 1} / {scenes.length}
                    </span>
                </header>

                {/* Page Content */}
                <main className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center">
                        {/* Image */}
                        <div className="md:w-1/2 aspect-square rounded-3xl overflow-hidden shadow-2xl bg-amber-800/30">
                            {currentScene.generatedImageUrl ? (
                                <img
                                    src={currentScene.generatedImageUrl}
                                    alt={`Page ${currentPage + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-amber-400/50">
                                    <span className="material-symbols-outlined text-8xl">image</span>
                                </div>
                            )}
                        </div>

                        {/* Text */}
                        <div className="md:w-1/2 text-center md:text-left">
                            <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-white leading-relaxed">
                                {currentScene.text}
                            </p>
                        </div>
                    </div>
                </main>

                {/* Controls */}
                <footer className="h-24 flex items-center justify-center gap-6 px-6">
                    {/* Previous */}
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 0}
                        className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <span className="material-symbols-outlined">skip_previous</span>
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={isPlaying ? handlePause : handlePlay}
                        className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-all"
                    >
                        <span className="material-symbols-outlined text-3xl">
                            {isPlaying && !isPaused ? 'pause' : 'play_arrow'}
                        </span>
                    </button>

                    {/* Next */}
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= scenes.length - 1}
                        className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <span className="material-symbols-outlined">skip_next</span>
                    </button>
                </footer>

                {/* Keyboard hints */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 text-white/40 text-xs">
                    <span>Space: Play/Pause</span>
                    <span>←→: Navigate</span>
                    <span>Esc: Exit</span>
                </div>
            </div>
        </div>
    );
}
