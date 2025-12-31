'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SelectionCardProps {
    title: string;
    description: string;
    icon: string;
    isSelected: boolean;
    onClick: () => void;
}

export function SelectionCard({ title, description, icon, isSelected, onClick }: SelectionCardProps) {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "relative flex flex-col w-full bg-white rounded-3xl overflow-hidden text-left border-4 transition-all duration-300 shadow-sm",
                isSelected
                    ? "border-[#D4A373] ring-4 ring-[#D4A373]/10 shadow-lg"
                    : "border-transparent hover:border-[#D4A373]/30 hover:shadow-md"
            )}
        >
            {/* Card Header (Brown Top) */}
            <div className="w-full py-4 bg-[#A98467] flex items-center justify-center relative">
                <h3 className="text-white font-bold text-lg font-serif tracking-wide">{title}</h3>

                {isSelected && (
                    <div className="absolute right-4 bg-white rounded-full w-6 h-6 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#A98467] text-sm font-bold">check</span>
                    </div>
                )}
            </div>

            {/* Card Body */}
            <div className="p-8 flex flex-col items-center justify-center text-center gap-6 h-full bg-gradient-to-b from-[#FFFDF9] to-[#F7F3EF]">
                {/* Icon Circle */}
                <div className="w-32 h-32 rounded-full bg-[#EAE0D5]/50 flex items-center justify-center relative overflow-hidden">
                    {/* Simple geometric shapes to mimic illustration background */}
                    <div className="absolute bottom-0 w-full h-1/2 bg-[#D4A373]/20 rounded-t-full"></div>
                    <span className="material-symbols-outlined text-[#8D7B68] text-[64px] relative z-10">{icon}</span>
                </div>

                <p className="text-[#5C4D44] text-sm font-medium leading-relaxed max-w-[200px]">
                    {description}
                </p>
            </div>
        </motion.button>
    );
}
