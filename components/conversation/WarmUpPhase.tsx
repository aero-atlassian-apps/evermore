'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useElevenLabsConversation } from '@/lib/hooks/useElevenLabsConversation';
import type { TranscriptEntry, WarmUpPhaseResult } from '@/lib/types/elevenlabs-websocket';

interface WarmUpPhaseProps {
    userName: string;
    sessionId: string;
    onComplete: (result: WarmUpPhaseResult & { extractedTopic: string | null }) => void;
    onError: (error: string) => void;
}

export function WarmUpPhase({ userName, sessionId, onComplete, onError }: WarmUpPhaseProps) {
    const [showStartButton, setShowStartButton] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [hasConnected, setHasConnected] = useState(false);

    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

    const handleReadyToTransition = useCallback(() => {
        setShowStartButton(true);
    }, []);

    const {
        phase,
        isConnected,
        isSpeaking,
        isListening,
        transcript,
        error,
        connect,
        disconnect,
        getResult,
    } = useElevenLabsConversation({
        agentId,
        userName,
        onReadyToTransition: handleReadyToTransition,
        onError,
    });

    const hasConnectedRef = React.useRef(false);

    // ...

    // Auto-connect on mount - only once
    useEffect(() => {
        if (!hasConnectedRef.current && phase === 'idle') {
            console.log('[WarmUpPhase] Initiating connection...');
            hasConnectedRef.current = true;
            connect();
        }
        // Cleanup on unmount only
        return () => {
            console.log('[WarmUpPhase] Unmounting, disconnecting...');
            disconnect();
            // Note: We don't reset hasConnectedRef here to prevent double-connect on Remount (Strict Mode)
            // But if the user navigates away and back, the component instance is new, so ref is new.
        };

    }, []); // Empty deps - run only on mount/unmount

    // Handle completing the warm-up phase
    const handleStartStory = useCallback(async () => {
        if (isCompleting) return;
        setIsCompleting(true);

        try {
            // Disconnect from ElevenLabs
            disconnect();

            // Get result data
            const result = getResult();

            // Save to backend and extract topic via LLM
            const response = await fetch('/api/conversation/warmup/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    transcript: result.transcript,
                    durationSeconds: result.durationSeconds,
                    conversationId: result.conversationId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save warm-up data');
            }

            const data = await response.json();

            // Callback to parent with extracted topic
            onComplete({
                ...result,
                extractedTopic: data.extractedTopic,
            });

        } catch (err: any) {
            console.error('[WarmUpPhase] Complete error:', err);
            onError(err.message || 'Failed to complete warm-up');
            setIsCompleting(false);
        }
    }, [isCompleting, sessionId, disconnect, getResult, onComplete, onError]);

    // Render status indicator
    const renderStatus = () => {
        if (phase === 'idle' || phase === 'connecting') {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                    <div className="flex gap-0.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '100ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '200ms' }} />
                    </div>
                    <span className="text-sm font-bold text-blue-700">Connecting...</span>
                </div>
            );
        }

        if (isSpeaking) {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-terracotta/10 to-orange-100 rounded-full">
                    <div className="flex gap-0.5 items-end h-5">
                        {[...Array(5)].map((_, i) => (
                            <span
                                key={i}
                                className="w-1 bg-terracotta rounded-full animate-pulse"
                                style={{
                                    height: `${10 + Math.sin(i * 0.8) * 8}px`,
                                    animationDelay: `${i * 80}ms`,
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-sm font-bold text-terracotta">🔊 Evermore is speaking</span>
                </div>
            );
        }

        if (isListening) {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                    <div className="flex gap-0.5 items-center h-5">
                        {[...Array(7)].map((_, i) => (
                            <span
                                key={i}
                                className="w-1 bg-emerald-500 rounded-full transition-all duration-75 animate-pulse"
                                style={{
                                    height: `${8 + Math.random() * 12}px`,
                                    animationDelay: `${i * 50}ms`,
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-sm font-bold text-emerald-700">🎙️ Listening</span>
                </div>
            );
        }

        if (isConnected || phase === 'active' || phase === 'ready_to_transition') {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-medium text-slate-600">Connected</span>
                </div>
            );
        }

        return null;
    };

    const formatTime = () => {
        return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header with status */}
            <div className="h-16 border-b border-peach-main/5 flex items-center justify-between px-6 bg-gradient-to-r from-white/80 to-peach-main/5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">
                        Warm-up
                    </div>
                    {renderStatus()}
                </div>

                <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-lg">chat_bubble</span>
                    <span className="text-sm font-medium">{transcript.length}</span>
                </div>
            </div>

            {/* Transcript Area */}
            <div className="flex-grow overflow-y-auto p-10 space-y-6 no-scrollbar scroll-smooth">
                {transcript.length === 0 && phase === 'connecting' && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-peach-main/20 flex items-center justify-center mb-4 animate-pulse">
                            <span className="material-symbols-outlined text-3xl text-terracotta">mic</span>
                        </div>
                        <p className="text-lg font-medium text-text-secondary">Connecting to Evermore...</p>
                        <p className="text-sm text-text-muted mt-2">Get ready to have a quick chat!</p>
                    </div>
                )}

                {transcript.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.speaker === 'agent' ? 'items-start' : 'items-end'} animate-fade-in-up`}>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">
                            {msg.speaker === 'agent' ? 'Evermore' : 'You'} • {formatTime()}
                        </span>
                        <div className="flex items-end gap-3 max-w-[80%]">
                            {msg.speaker === 'agent' && (
                                <div className="w-10 h-10 rounded-full bg-peach-main/30 border border-peach-main/20 flex items-center justify-center flex-shrink-0 text-terracotta mb-2 shadow-sm">
                                    <span className="material-symbols-outlined text-lg filled">mic</span>
                                </div>
                            )}
                            <div className={`
                p-5 rounded-[1.5rem] text-lg font-medium leading-relaxed font-sans shadow-sm
                ${msg.speaker === 'agent'
                                    ? 'bg-[#F9F4EE] text-text-primary rounded-bl-none border border-[#F0E6D9]'
                                    : 'bg-[#FDE2D0] text-text-primary rounded-br-none border border-peach-main/30 shadow-peach-warm/10'
                                }
              `}>
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}

                {error && (
                    <div className="flex justify-center">
                        <div className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action Area */}
            <div className="p-6 border-t border-peach-main/10 bg-gradient-to-r from-white to-peach-main/5">
                {showStartButton ? (
                    <button
                        onClick={handleStartStory}
                        disabled={isCompleting}
                        className="w-full py-5 px-8 bg-gradient-to-r from-terracotta to-sienna text-white rounded-2xl font-bold text-xl shadow-xl shadow-terracotta/30 transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {isCompleting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">sync</span>
                                <span>Starting...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-2xl filled">play_circle</span>
                                <span>Start Telling Your Story</span>
                            </>
                        )}
                    </button>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-text-secondary">
                            {phase === 'active'
                                ? "Chat with Evermore, then click the button when you're ready to begin your story."
                                : "Connecting to Evermore..."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
