'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ChatContainerProps {
    children: React.ReactNode;
    agentState: string;
}

export function ChatContainer({ children, agentState }: ChatContainerProps) {
    const getThinkingText = () => {
        switch (agentState) {
            case 'thinking': return 'Evermore is thinking...';
            case 'listening': return 'Listening...';
            case 'speaking': return 'Evermore is speaking...';
            default: return '';
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-[32px] shadow-sm border border-[#E07A5F]/10 min-h-[60vh] flex flex-col relative overflow-hidden">
            {/* Status Bar */}
            <div className="h-12 border-b border-[#E07A5F]/5 flex items-center justify-center">
                {agentState !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                    >
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E07A5F] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                        </div>
                        <span className="text-sm font-semibold text-[#3D3430]">{getThinkingText()}</span>
                    </motion.div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-8 overflow-y-auto w-full relative">
                {children}
            </div>
        </div>
    );
}
