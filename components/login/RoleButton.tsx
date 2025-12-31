'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface RoleButtonProps {
    role: 'senior' | 'family';
    loading: boolean;
    onClick: () => void;
}

export function RoleButton({ role, loading, onClick }: RoleButtonProps) {
    const isSenior = role === 'senior';
    const label = isSenior ? 'Login as Senior' : 'Login as Family Member';
    const icon = isSenior ? 'person' : 'diversity_1';

    return (
        <motion.button
            onClick={onClick}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                group relative flex flex-col items-center justify-center gap-4 
                w-full aspect-[4/3] rounded-3xl border-2 transition-all duration-300
                ${loading ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
                bg-[#F8E1C7]/30 border-transparent hover:border-[#E0A885]/30 hover:bg-[#F8E1C7]/50 hover:shadow-lg hover:shadow-[#E0A885]/10
            `}
        >
            <div className={`
                w-16 h-16 rounded-full flex items-center justify-center transition-colors
                ${isSenior ? 'bg-[#E07A5F]/10 text-[#E07A5F]' : 'bg-[#756A63]/10 text-[#756A63]'}
                group-hover:bg-[#E07A5F] group-hover:text-white
            `}>
                <span className="material-symbols-outlined text-3xl filled">{icon}</span>
            </div>

            <span className="font-bold text-[#3D3430] text-lg font-display">
                {label}
            </span>

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:animate-shine" />
            </div>
        </motion.button>
    );
}
