'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export function FloatingPillHeader() {
    return (
        <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        >
            <div className="bg-[#E5E0D8]/80 backdrop-blur-xl border border-white/50 shadow-lg shadow-black/5 rounded-full px-6 py-3 flex items-center justify-between pointer-events-auto min-w-[320px] md:min-w-[500px] max-w-4xl w-full mx-auto">

                {/* Logo Area */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E07A5F]/10 flex items-center justify-center text-[#E07A5F] border border-[#E07A5F]/20">
                        <Image src="/evermore-icon-terracotta.svg" alt="Evermore Logo" width={18} height={18} className="object-contain" />
                    </div>
                    <span className="text-[#3D3430] font-bold text-lg font-display tracking-tight">Evermore</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#756A63] hover:bg-black/5 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">mic</span>
                    </button>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#756A63] hover:bg-black/5 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                    </button>
                    <div className="w-px h-4 bg-black/10 mx-1"></div>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#756A63] hover:bg-black/5 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                    </button>
                </div>
            </div>
        </motion.header>
    );
}
