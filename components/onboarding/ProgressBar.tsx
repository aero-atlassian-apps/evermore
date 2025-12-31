'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
    currentStep: number;
    totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
    return (
        <div className="w-full max-w-md mx-auto mb-12">
            <p className="text-center text-sm font-bold text-[#3D3430] mb-4">
                Step {currentStep} of {totalSteps}: Whose stories are you preserving?
            </p>

            <div className="relative flex items-center justify-between">
                {/* Background Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-[#EAE0D5] -z-10 rounded-full"></div>

                {/* Active Line */}
                <motion.div
                    className="absolute top-1/2 left-0 h-1 bg-[#D4A373] -z-10 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                ></motion.div>

                {Array.from({ length: totalSteps }).map((_, index) => {
                    const step = index + 1;
                    const isActive = step <= currentStep;
                    const isCurrent = step === currentStep;

                    return (
                        <div key={step} className="relative">
                            <motion.div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-500
                        ${isActive ? 'bg-[#D4A373] border-[#D4A373]' : 'bg-[#EAE0D5] border-[#EAE0D5]'}
                        ${isCurrent ? 'ring-4 ring-[#D4A373]/20 scale-110' : ''}
                     `}
                                initial={false}
                                animate={{ scale: isCurrent ? 1.2 : 1 }}
                            >
                                {isActive && !isCurrent && (
                                    <span className="material-symbols-outlined text-[14px] text-white font-bold">check</span>
                                )}
                            </motion.div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
