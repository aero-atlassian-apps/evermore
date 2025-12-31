'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ConversationState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ConversationStatusProps {
    state: ConversationState;
    className?: string;
}

export function ConversationStatus({ state, className = '' }: ConversationStatusProps) {
    return (
        <div className={`relative h-12 flex items-center justify-center ${className}`}>
            <AnimatePresence mode="wait">
                {state === 'idle' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-2 px-5 py-2 bg-slate-50/80 rounded-full border border-slate-100 backdrop-blur-sm"
                    >
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ready</span>
                    </motion.div>
                )}

                {state === 'listening' && (
                    <motion.div
                        key="listening"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-3 px-6 py-2.5 bg-emerald-50/90 rounded-full shadow-sm border border-emerald-100 backdrop-blur-sm"
                    >
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-extrabold text-emerald-700 uppercase tracking-wide">Listening</span>
                    </motion.div>
                )}

                {state === 'thinking' && (
                    <motion.div
                        key="thinking"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="flex items-center gap-3 px-6 py-2.5 bg-amber-50/90 rounded-full shadow-sm border border-amber-100 backdrop-blur-sm"
                    >
                        <div className="flex gap-1">
                            <motion.div
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                className="w-2 h-2 bg-amber-400 rounded-full"
                            />
                            <motion.div
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                className="w-2 h-2 bg-amber-500 rounded-full"
                            />
                            <motion.div
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                className="w-2 h-2 bg-amber-600 rounded-full"
                            />
                        </div>
                        <span className="text-sm font-extrabold text-amber-700 uppercase tracking-wide">Thinking</span>
                    </motion.div>
                )}

                {state === 'speaking' && (
                    <motion.div
                        key="speaking"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-terracotta/10 to-orange-100 rounded-full shadow-sm border border-terracotta/10 backdrop-blur-sm"
                    >
                        <div className="flex gap-1 items-end h-4">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="w-1 bg-terracotta rounded-full animate-music-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                        </div>
                        <span className="text-sm font-extrabold text-terracotta uppercase tracking-wide">Speaking</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
