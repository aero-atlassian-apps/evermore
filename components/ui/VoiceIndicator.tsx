import React from 'react';

type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface VoiceIndicatorProps {
    mode: VoiceMode;
    className?: string;
}

export function VoiceIndicator({ mode, className = '' }: VoiceIndicatorProps) {
    return (
        <div className={`flex items-center justify-center h-24 w-full ${className}`}>
            {mode === 'idle' && (
                <div className="w-4 h-4 rounded-full bg-white/20 transition-all duration-500" />
            )}

            {mode === 'listening' && (
                <div className="flex items-center gap-1.5 h-full">
                    <div className="w-1.5 h-4 bg-primary rounded-full animate-wave-slow" />
                    <div className="w-1.5 h-8 bg-primary rounded-full animate-wave-medium" />
                    <div className="w-1.5 h-12 bg-primary rounded-full animate-wave-fast" />
                    <div className="w-1.5 h-8 bg-primary rounded-full animate-wave-medium" />
                    <div className="w-1.5 h-4 bg-primary rounded-full animate-wave-slow" />
                </div>
            )}

            {mode === 'thinking' && (
                <div className="relative flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/30 animate-ping absolute" />
                    <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse-slow flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                </div>
            )}

            {mode === 'speaking' && (
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" />
                </div>
            )}

            {mode === 'error' && (
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/30">
                    <span className="material-symbols-outlined text-destructive text-xl">priority_high</span>
                </div>
            )}
        </div>
    );
}
