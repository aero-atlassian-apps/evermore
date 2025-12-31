'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface InputAreaProps {
    inputValue: string;
    onInputChange: (val: string) => void;
    onSend: () => void;
    isListening: boolean;
    onMicClick: () => void;
}

export function InputArea({ inputValue, onInputChange, onSend, isListening, onMicClick }: InputAreaProps) {
    return (
        <div className="relative w-full max-w-4xl mx-auto mt-auto pb-4 pt-4 px-4 flex items-center gap-6">

            {/* Mic Button - Floating Outside Left */}
            <div className="relative">
                {/* Glow Effect */}
                <motion.div
                    animate={isListening ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : { opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-[-10px] bg-[#E07A5F] rounded-full blur-xl z-0"
                />
                <div className="absolute inset-[-20px] bg-[#F2CC8F]/30 rounded-full blur-2xl z-[-1]" />

                <motion.button
                    onClick={onMicClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
                ${isListening
                            ? 'bg-[#E07A5F] text-white'
                            : 'bg-gradient-to-br from-[#E07A5F] to-[#C66348] text-white'
                        }`}
                >
                    <span className="material-symbols-outlined text-[40px] filled">mic</span>
                </motion.button>

                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold text-[#3D3430]">
                    Tap to Speak
                </div>
            </div>

            {/* Input Field Area */}
            <div className="flex-1 relative flex items-center">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSend()}
                    placeholder="Type your story..."
                    className="w-full h-16 pl-6 pr-40 rounded-full border-2 border-[#E07A5F]/20 bg-white/80 focus:bg-white focus:border-[#E07A5F]/50 focus:outline-none focus:ring-4 focus:ring-[#E07A5F]/10 text-lg text-[#3D3430] placeholder:text-[#756A63]/40 shadow-sm transition-all"
                />

                <button
                    onClick={onSend}
                    disabled={!inputValue.trim()}
                    className="absolute right-2 h-12 px-6 rounded-full bg-[#E07A5F] hover:bg-[#C66348] text-white font-bold text-sm transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:shadow-none"
                >
                    Send Message
                    <span className="material-symbols-outlined text-lg">send</span>
                </button>
            </div>

        </div>
    );
}
