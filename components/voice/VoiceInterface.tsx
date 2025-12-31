'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TranscriptEntry {
    text: string;
    isAI: boolean;
    timestamp: Date;
    duration?: number; // Duration in seconds
}

interface VoiceInterfaceProps {
    /** Whether currently listening to user */
    isListening: boolean;
    /** Whether AI is currently speaking */
    isAISpeaking: boolean;
    /** Current agent state */
    agentState: 'idle' | 'thinking' | 'responding' | 'listening';
    /** Transcript entries with timestamps */
    transcript: TranscriptEntry[];
    /** Current streaming response (partial) */
    streamingText?: string;
    /** Audio volume level (0-1) */
    volumeLevel?: number;
    /** Session start time */
    sessionStartTime?: Date;
    /** Called when user wants to toggle listening */
    onToggleListening: () => void;
    /** Called when user wants to end session */
    onEndSession: () => void;
}

/**
 * VoiceInterface - Premium voice-first conversation UI
 * 
 * Features:
 * - Real-time waveform visualization
 * - Timeline-based transcript with timestamps
 * - Visual states: listening, AI speaking, thinking, idle
 * - Smooth animations and transitions
 */
export function VoiceInterface({
    isListening,
    isAISpeaking,
    agentState,
    transcript,
    streamingText,
    volumeLevel = 0,
    sessionStartTime,
    onToggleListening,
    onEndSession,
}: VoiceInterfaceProps) {
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript, streamingText]);

    // Format timestamp relative to session start
    const formatTimestamp = (timestamp: Date): string => {
        if (!sessionStartTime) {
            return timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }

        const elapsed = Math.floor((timestamp.getTime() - sessionStartTime.getTime()) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Get status text and color
    const getStatus = () => {
        if (isAISpeaking) {
            return { text: 'Evermore is speaking...', color: 'text-terracotta', animate: true };
        }
        if (agentState === 'thinking') {
            return { text: 'Thinking...', color: 'text-amber-500', animate: true };
        }
        if (isListening) {
            return { text: 'Listening...', color: 'text-emerald-500', animate: true };
        }
        return { text: 'Tap to speak', color: 'text-slate-400', animate: false };
    };

    const status = getStatus();

    return (
        <div className="voice-interface flex flex-col h-full">
            {/* Status Bar */}
            <div className="status-bar h-16 flex items-center justify-center border-b border-peach-main/10 bg-gradient-to-r from-white/50 to-peach-main/5">
                <div className="flex items-center gap-3">
                    {status.animate && (
                        <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                                <span
                                    key={i}
                                    className={`w-1 rounded-full ${status.color.replace('text-', 'bg-')} transition-all duration-150`}
                                    style={{
                                        height: isAISpeaking
                                            ? `${12 + ((i * 3) % 8)}px`
                                            : isListening
                                                ? `${8 + volumeLevel * 20 + ((i * 7) % 5)}px`
                                                : '8px',
                                        animationDelay: `${i * 100}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    )}
                    <span className={`font-semibold ${status.color}`}>{status.text}</span>
                </div>
            </div>

            {/* Timeline Transcript */}
            <div className="transcript-area flex-1 overflow-y-auto p-6 space-y-4">
                {transcript.length === 0 && !streamingText && (
                    <div className="text-center py-12 text-slate-400">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-peach-main/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-peach-warm">mic</span>
                        </div>
                        <p className="font-medium">Ready to capture your story</p>
                        <p className="text-sm mt-1">Press the microphone to begin</p>
                    </div>
                )}

                {transcript.map((entry, i) => (
                    <div
                        key={i}
                        className={`transcript-entry flex gap-4 ${entry.isAI ? '' : 'flex-row-reverse'}`}
                    >
                        {/* Timeline marker */}
                        <div className="timeline-marker flex flex-col items-center">
                            <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                {formatTimestamp(entry.timestamp)}
                            </span>
                            <div className={`w-3 h-3 rounded-full mt-2 ${entry.isAI ? 'bg-terracotta' : 'bg-emerald-500'
                                }`} />
                            {i < transcript.length - 1 && (
                                <div className="w-px flex-1 bg-slate-200 mt-1" />
                            )}
                        </div>

                        {/* Message bubble */}
                        <div className={`message-bubble max-w-[75%] ${entry.isAI ? '' : 'text-right'
                            }`}>
                            <div className={`inline-block px-5 py-3 rounded-2xl ${entry.isAI
                                ? 'bg-peach-main/10 text-slate-800 rounded-tl-md'
                                : 'bg-emerald-50 text-slate-800 rounded-tr-md'
                                }`}>
                                <p className="leading-relaxed">{entry.text}</p>
                            </div>
                            <div className={`text-xs mt-1 ${entry.isAI ? 'text-left text-terracotta' : 'text-right text-emerald-600'
                                }`}>
                                {entry.isAI ? '🎙️ Evermore' : '👤 You'}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Streaming Response */}
                {streamingText && (
                    <div className="transcript-entry flex gap-4 animate-pulse">
                        <div className="timeline-marker flex flex-col items-center">
                            <span className="text-xs text-slate-400 font-mono">now</span>
                            <div className="w-3 h-3 rounded-full mt-2 bg-terracotta animate-pulse" />
                        </div>
                        <div className="message-bubble max-w-[75%]">
                            <div className="inline-block px-5 py-3 rounded-2xl bg-peach-main/10 text-slate-800 rounded-tl-md">
                                <p className="leading-relaxed">{streamingText}</p>
                                <span className="inline-block w-2 h-4 bg-terracotta ml-1 animate-pulse" />
                            </div>
                            <div className="text-xs mt-1 text-left text-terracotta">
                                🎙️ Evermore
                            </div>
                        </div>
                    </div>
                )}

                <div ref={transcriptEndRef} />
            </div>

            {/* Waveform Visualizer */}
            {isListening && (
                <div className="waveform-container h-24 bg-gradient-to-t from-peach-main/5 to-transparent flex items-center justify-center">
                    <WaveformVisualizer volumeLevel={volumeLevel} />
                </div>
            )}

            {/* Control Bar */}
            <div className="control-bar h-24 border-t border-peach-main/10 bg-white flex items-center justify-center gap-6">
                {/* Main Mic Button */}
                <button
                    onClick={onToggleListening}
                    disabled={isAISpeaking}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${isListening
                        ? 'bg-gradient-to-br from-red-500 to-red-600 text-white scale-110 animate-pulse'
                        : isAISpeaking
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-br from-terracotta to-amber-600 text-white hover:scale-105 active:scale-95'
                        }`}
                >
                    <span className="material-symbols-outlined text-2xl filled">
                        {isListening ? 'stop' : 'mic'}
                    </span>
                </button>

                {/* End Session Button */}
                <button
                    onClick={onEndSession}
                    disabled={isListening || isAISpeaking}
                    className={`px-6 py-3 rounded-full font-semibold transition-all ${isListening || isAISpeaking
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                >
                    End Story
                </button>
            </div>

            <style jsx>{`
                .transcript-area::-webkit-scrollbar {
                    width: 4px;
                }
                .transcript-area::-webkit-scrollbar-track {
                    background: transparent;
                }
                .transcript-area::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
}

/**
 * Waveform Visualizer component
 */
function WaveformVisualizer({ volumeLevel }: { volumeLevel: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const barsRef = useRef<number[]>(Array(32).fill(0));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const animate = () => {
            const bars = barsRef.current;
            const width = canvas.width;
            const height = canvas.height;
            const barWidth = width / bars.length;

            ctx.clearRect(0, 0, width, height);

            // Update bar heights with smooth interpolation
            for (let i = 0; i < bars.length; i++) {
                const target = (volumeLevel * 0.7 + Math.random() * 0.3) * height;
                bars[i] += (target - bars[i]) * 0.3;
            }

            // Draw bars
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, '#ea580c');
            gradient.addColorStop(1, '#f97316');

            bars.forEach((h, i) => {
                const x = i * barWidth + barWidth * 0.1;
                const w = barWidth * 0.8;
                const y = (height - h) / 2;

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, 3);
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [volumeLevel]);

    return (
        <canvas
            ref={canvasRef}
            width={320}
            height={64}
            className="rounded-lg"
        />
    );
}

export type { TranscriptEntry };
