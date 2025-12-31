'use client';

import React from 'react';
import Link from 'next/link';

interface SettingsLayoutProps {
    children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
    return (
        <div className="min-h-screen bg-[#FDFCF8] font-sans text-[#3D3430] flex flex-col items-center pt-10 pb-20">
            <div className="w-full max-w-2xl px-6">
                <header className="flex items-center gap-4 mb-10">
                    <Link href="/dashboard" className="w-10 h-10 rounded-full hover:bg-[#E07A5F]/10 flex items-center justify-center text-[#756A63] transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold font-serif text-[#3D3430]">
                        Evermore <span className="font-sans text-[#5C4D44] font-medium">Personalized Settings</span>
                    </h1>
                </header>

                <main className="space-y-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
