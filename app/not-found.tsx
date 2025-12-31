'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full animate-fade-in">
                <div className="w-24 h-24 bg-peach-main/10 rounded-full flex items-center justify-center text-terracotta mx-auto mb-8 shadow-lg shadow-peach-warm/10">
                    <span className="material-symbols-outlined text-5xl">search_off</span>
                </div>

                <h1 className="text-4xl font-serif font-black text-text-primary mb-4">
                    Page Not Found
                </h1>

                <p className="text-lg text-text-secondary mb-10 leading-relaxed font-medium opacity-80">
                    The story you're looking for seems to have wandered off the path. Let's get you back home.
                </p>

                <div className="space-y-4">
                    <Link
                        href="/"
                        className="inline-block bg-terracotta text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-peach-warm/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
