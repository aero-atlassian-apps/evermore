'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface MessageBubbleProps {
    text: string;
    isAI: boolean;
    timestamp?: string;
    isStreaming?: boolean;
}

export function MessageBubble({ text, isAI, timestamp, isStreaming }: MessageBubbleProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex w-full mb-6 ${isAI ? 'justify-start' : 'justify-end'} group`}
        >
            <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[75%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>

                {/* Avatar / Icon */}
                {isAI && (
                    <div className="w-8 h-8 rounded-full bg-peach-main/20 flex items-center justify-center flex-shrink-0 text-terracotta mb-2">
                        <span className={`material-symbols-outlined text-sm font-bold ${isStreaming ? 'animate-pulse' : ''}`}>
                            smart_toy
                        </span>
                    </div>
                )}

                <div className="flex flex-col relative">
                    <div
                        className={`
                          px-6 py-4 text-lg md:text-xl font-medium leading-relaxed font-sans shadow-sm transition-all
                          ${isAI
                                ? 'bg-white border border-peach-main/10 text-text-primary rounded-[2rem] rounded-bl-sm'
                                : 'bg-gradient-to-br from-peach-warm to-terracotta text-white rounded-[2rem] rounded-br-sm shadow-terracotta/20'
                            }
                          ${isStreaming ? 'opacity-90' : ''}
                        `}
                    >
                        {text}
                        {isStreaming && (
                            <span className="inline-block w-2 h-5 align-middle bg-terracotta/50 ml-1 animate-pulse rounded-full" />
                        )}
                    </div>

                    {/* Timestamp - Only show for non-streaming messages, on hover or if explicitly passed */}
                    {!isStreaming && timestamp && (
                        <span className={`text-[10px] uppercase tracking-wider font-bold text-text-muted mt-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6 ${isAI ? 'left-0' : 'right-0'} whitespace-nowrap`}>
                            {timestamp}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
