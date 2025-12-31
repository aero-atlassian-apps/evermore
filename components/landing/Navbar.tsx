'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Navbar() {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);

    useMotionValueEvent(scrollY, "change", (latest) => {
        setIsScrolled(latest > 20);
    });

    return (
        <motion.header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300",
                isScrolled ? "bg-white/80 backdrop-blur-md border-b border-stone-200/50 py-3 shadow-sm" : "bg-transparent py-5"
            )}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#E07A5F]/10 flex items-center justify-center border border-[#E07A5F]/20 p-2">
                        <img src="/evermore-icon-only.svg" alt="Evermore Logo" className="w-full h-full object-contain filter drop-shadow-sm" />
                    </div>
                    <span className="text-xl font-bold font-display leading-tight tracking-tight text-[#3D3430]">Evermore</span>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="/login">
                        <motion.button
                            className="px-5 py-2.5 rounded-full font-semibold text-sm text-[#756A63] hover:text-[#3D3430] hover:bg-stone-100 transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Log In
                        </motion.button>
                    </Link>
                    <Link href="/onboarding">
                        <motion.button
                            className="hidden sm:flex px-6 py-2.5 rounded-full bg-[#E07A5F] text-white font-bold text-sm shadow-lg shadow-[#E07A5F]/20 hover:bg-[#C66348] transition-colors items-center gap-2"
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Get Started
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </motion.button>
                    </Link>
                </div>
            </div>
        </motion.header>
    );
}
