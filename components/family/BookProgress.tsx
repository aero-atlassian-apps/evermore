'use client';

import React from 'react';

interface BookProgressProps {
    chapterCount: number;
    totalGoal?: number;
    onExport: () => void;
    isExporting: boolean;
}

export function BookProgress({ chapterCount, totalGoal = 12, onExport, isExporting }: BookProgressProps) {
    const percentage = Math.min((chapterCount / totalGoal) * 100, 100);

    return (
        <div className="mb-10">
            <h2 className="text-2xl font-bold font-serif text-[#3D3430] mb-4">Book Progress</h2>

            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-6xl font-black text-[#D6C5B3] font-display">{chapterCount}</span>
                <span className="text-lg text-[#5C4D44] font-medium">of {totalGoal} chapters</span>
                <span className="ml-auto text-xl font-bold text-[#3D3430]">{Math.round(percentage)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-4 bg-[#EAE0D5] rounded-full overflow-hidden mb-6">
                <div
                    className="h-full bg-gradient-to-r from-[#5C9E94] to-[#E07A5F]"
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>

            <button
                onClick={onExport}
                disabled={isExporting}
                className="w-full py-4 bg-[#CE8944] hover:bg-[#B37233] text-white rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isExporting ? 'Generating PDF...' : 'Export Book (PDF)'}
            </button>
        </div>
    );
}
