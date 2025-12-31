'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export function RecordButton() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] relative py-8 mb-12 z-10 w-full">
            {/* Decorative Background Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-80 h-80 rounded-full border border-[#E07A5F]/10 bg-[#E07A5F]/5"
                />
                <div className="absolute w-64 h-64 rounded-full border border-[#E07A5F]/20"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative z-10 flex flex-col items-center"
            >
                <h1 className="text-xl font-medium text-center mb-10 text-[#756A63] tracking-wide">
                    Ready to share a story?
                </h1>

                <div className="relative group flex items-center justify-center">
                    {/* Pulse Effect */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-[#E07A5F]/40 blur-xl"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />

                    <Link href="/conversation">
                        <motion.button
                            className="relative flex items-center justify-center w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-[#E07A5F] to-[#C66348] text-white shadow-2xl shadow-[#E07A5F]/40 border-4 border-white/20"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <span className="material-symbols-outlined text-6xl drop-shadow-md">mic</span>
                        </motion.button>
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 text-center"
                >
                    <p className="text-sm font-semibold text-[#756A63]/80 bg-white/60 px-5 py-2 rounded-full backdrop-blur-md border border-white/50 shadow-sm">
                        Tap the microphone to start
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
