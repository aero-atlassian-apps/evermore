'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToneSelectorProps {
    currentTone: string;
    onSelect: (tone: string) => void;
}

const TONES = ['Warm', 'Friendly', 'Gentle'];

export function ToneSelector({ currentTone, onSelect }: ToneSelectorProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold font-serif text-[#3D3430]">Voice Tone</h2>
            <div className="flex gap-4">
                {TONES.map((tone) => {
                    const isSelected = currentTone.toLowerCase() === tone.toLowerCase();

                    return (
                        <motion.button
                            key={tone}
                            onClick={() => onSelect(tone.toLowerCase())}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                                "px-8 py-3 rounded-2xl font-bold text-lg transition-all shadow-sm",
                                isSelected
                                    ? "bg-[#F2CC8F] text-[#3D3430] ring-4 ring-[#F2CC8F]/20 shadow-md"
                                    : "bg-[#F8E1C7] text-[#756A63] hover:bg-[#F2CC8F]/50"
                            )}
                        >
                            {tone}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
