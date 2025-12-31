'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ChapterAudioPlayerProps {
    /** Base64 audio data URL or remote URL */
    audioUrl?: string;
    /** Chapter title for display */
    title: string;
    /** Estimated duration in seconds */
    duration?: number;
    /** Loading state */
    isGenerating?: boolean;
    /** Callback when audio generation is requested */
    onRequestGenerate?: () => void;
    /** Whether to auto-play on load */
    autoPlay?: boolean;
}

/**
 * ChapterAudioPlayer - Immersive audio player for story chapters
 * 
 * Features:
 * - Play/Pause/Seek controls
 * - Progress bar with time display
 * - Volume control
 * - Generate audio button if not available
 */
export function ChapterAudioPlayer({
    audioUrl,
    title,
    duration,
    isGenerating = false,
    onRequestGenerate,
    autoPlay = false,
}: ChapterAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration || 0);
    const [volume, setVolume] = useState(0.8);
    const [isLoaded, setIsLoaded] = useState(false);

    // Format time as mm:ss
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle audio events
    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current) {
            setAudioDuration(audioRef.current.duration);
            setIsLoaded(true);
            if (autoPlay) {
                audioRef.current.play();
            }
        }
    }, [autoPlay]);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, []);

    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        setCurrentTime(0);
    }, []);

    // Control functions
    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = vol;
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + seconds));
        }
    };

    // Update volume when component mounts
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // No audio available - show generate button
    if (!audioUrl) {
        return (
            <div className="chapter-audio-player-empty bg-gradient-to-r from-peach-main/10 to-amber-50 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-peach-main/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-terracotta">headphones</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Listen to Your Story</h3>
                <p className="text-slate-500 mb-4 text-sm">Generate an audio narration of this chapter</p>
                <button
                    onClick={onRequestGenerate}
                    disabled={isGenerating}
                    className={`px-6 py-3 rounded-full font-semibold transition-all ${isGenerating
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-terracotta to-amber-600 text-white hover:shadow-lg'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                            Generating...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-base align-middle mr-1">play_arrow</span>
                            Generate Audio
                        </>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="chapter-audio-player bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-terracotta to-amber-600 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">auto_stories</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{title}</h3>
                    <p className="text-slate-400 text-sm">
                        {isLoaded ? formatTime(audioDuration) : 'Loading...'}
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <input
                    type="range"
                    min="0"
                    max={audioDuration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={!isLoaded}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-progress"
                    style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / audioDuration) * 100}%, #334155 ${(currentTime / audioDuration) * 100}%, #334155 100%)`,
                    }}
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(audioDuration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
                {/* Skip back */}
                <button
                    onClick={() => skip(-15)}
                    disabled={!isLoaded}
                    className="p-2 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    <span className="material-symbols-outlined">replay_10</span>
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    disabled={!isLoaded}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-terracotta to-amber-600 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-3xl filled">
                        {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                </button>

                {/* Skip forward */}
                <button
                    onClick={() => skip(15)}
                    disabled={!isLoaded}
                    className="p-2 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    <span className="material-symbols-outlined">forward_10</span>
                </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 mt-4 px-4">
                <span className="material-symbols-outlined text-slate-400 text-sm">
                    {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                </span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #64748b 0%, #64748b ${volume * 100}%, #1e293b ${volume * 100}%, #1e293b 100%)`,
                    }}
                />
            </div>

            <style jsx>{`
                .slider-progress::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .slider-progress::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
