'use client';

import React from 'react';

interface PortalHeaderProps {
    displayName: string;
    onInvite: () => void;
}

export function PortalHeader({ displayName, onInvite }: PortalHeaderProps) {
    return (
        <div className="w-full relative rounded-[32px] overflow-hidden mb-12 shadow-sm">
            {/* Warm Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FDE6D2] via-[#E8C3A0] to-[#CFA07E]"></div>

            {/* Texture Overlay (Optional subtle noise if needed, keeping simple for now) */}
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>

            <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold font-serif text-[#3D3430] mb-3 tracking-tight">
                        {displayName} Portal
                    </h1>
                    <p className="text-[#5C4D44] text-lg font-medium max-w-lg leading-relaxed">
                        Immortalizing our family's stories, one conversation at a time.
                    </p>
                </div>

                <button
                    onClick={onInvite}
                    className="px-8 py-3 bg-[#E07A5F] hover:bg-[#C66348] text-white rounded-full font-bold text-lg shadow-lg shadow-[#E07A5F]/20 transition-all hover:scale-105 active:scale-95"
                >
                    Invite Family
                </button>
            </div>
        </div>
    );
}
