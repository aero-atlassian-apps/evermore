'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface DashboardHeaderProps {
    displayName?: string;
    loading: boolean;
    currentDate: string;
}

export function DashboardHeader({ displayName, loading, currentDate }: DashboardHeaderProps) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="flex flex-col items-center text-center mt-8 mb-10 px-6 z-10">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E07A5F]/10 border border-[#E07A5F]/20 text-[#E07A5F] text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
            >
                <span className="w-2 h-2 rounded-full bg-[#E07A5F] animate-pulse"></span>
                {currentDate}
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl md:text-5xl font-display font-extrabold leading-[1.1] tracking-tight text-[#3D3430]"
            >
                {getGreeting()}, <br className="sm:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E07A5F] to-orange-400">
                    {loading ? '...' : (displayName || 'Friend')}
                </span>
            </motion.h2>
        </div>
    );
}
