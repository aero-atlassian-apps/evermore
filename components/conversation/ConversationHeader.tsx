'use client';

import React from 'react';
import Link from 'next/link';

export function ConversationHeader() {
    return (
        <header className="flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto z-10 relative">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#E07A5F] text-3xl">mic_external_on</span>
                <span className="text-[#E07A5F] font-bold text-2xl font-display tracking-tight">Evermore</span>
            </div>

            <nav className="flex items-center gap-8">
                <Link href="/dashboard" className="px-4 py-2 bg-[#EAE0D5] text-[#3D3430] rounded-full text-sm font-semibold transition-colors hover:bg-[#E0CCD5]/50">
                    Home
                </Link>
                <Link href="#" className="text-[#3D3430] text-sm font-medium hover:text-[#E07A5F] transition-colors">
                    My Stories
                </Link>
                <Link href="#" className="text-[#3D3430] text-sm font-medium hover:text-[#E07A5F] transition-colors">
                    Profile
                </Link>
                <Link href="#" className="text-[#3D3430] text-sm font-medium hover:text-[#E07A5F] transition-colors">
                    Settings
                </Link>
            </nav>
        </header>
    );
}
