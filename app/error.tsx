'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an observability provider
        console.error('Global Error Boundary caught:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full animate-fade-in">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center text-red-500 mx-auto mb-8 shadow-lg shadow-red-200/50">
                    <span className="material-symbols-outlined text-5xl">error</span>
                </div>

                <h1 className="text-4xl font-serif font-black text-text-primary mb-4">
                    Something went wrong
                </h1>

                <p className="text-lg text-text-secondary mb-10 leading-relaxed font-medium opacity-80">
                    We've hit an unexpected bump in the road. Our team has been notified, and we're working on it.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={() => reset()}
                        className="w-full bg-terracotta text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-peach-warm/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        Try Again
                    </button>

                    <Link
                        href="/"
                        className="block w-full text-text-muted hover:text-terracotta font-bold transition-colors py-2"
                    >
                        Back to Home
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-12 text-[10px] uppercase tracking-[0.2em] text-text-muted font-black opacity-30">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
