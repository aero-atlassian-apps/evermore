import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { useAuth } from '@/lib/hooks/useAuth';

export function MarketingHeader() {
    const { isAuthenticated, user, isLoading } = useAuth();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#FCF8F3]/60 backdrop-blur-xl h-20 border-b border-peach-main/20">
            <div className="container mx-auto px-6 h-full">
                <div className="flex justify-between items-center h-full">

                    {/* Logo & Icon */}
                    <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
                        <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm transform group-hover:rotate-6 transition-transform">
                            <Image src="/evermore-icon-white.svg" alt="Evermore Logo" width={24} height={24} className="object-contain" />
                        </div>
                        <span className="text-2xl font-serif font-extrabold text-text-primary tracking-tight">Evermore</span>
                    </Link>

                    {/* Navigation - Pill Shaped */}
                    <nav className="hidden md:flex items-center bg-peach-light/50 border border-peach-main/30 rounded-full px-2 py-1 gap-1">
                        <Link href="/" className="px-5 py-2 text-sm font-sans font-bold text-text-secondary hover:text-terracotta hover:bg-white rounded-full transition-all">
                            Home
                        </Link>
                        <Link href="#how-it-works" className="px-5 py-2 text-sm font-sans font-bold text-text-secondary hover:text-terracotta hover:bg-white rounded-full transition-all">
                            How It Works
                        </Link>
                        <Link href="#pricing" className="px-5 py-2 text-sm font-sans font-bold text-text-secondary hover:text-terracotta hover:bg-white rounded-full transition-all">
                            Pricing
                        </Link>
                        <Link href="#about" className="px-5 py-2 text-sm font-sans font-bold text-text-secondary hover:text-terracotta hover:bg-white rounded-full transition-all">
                            About
                        </Link>
                    </nav>

                    {/* Action - Gradient Pill */}
                    <div>
                        {isLoading ? (
                            <div className="w-24 h-10 bg-peach-main/20 rounded-full animate-pulse"></div>
                        ) : isAuthenticated ? (
                            <Link
                                href={user?.role === 'family' ? '/family' : '/stories'}
                                className="inline-flex items-center px-8 py-2.5 rounded-full bg-terracotta text-white font-sans font-extrabold text-sm hover:bg-sienna shadow-sm hover:shadow-md transition-all duration-300"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="inline-flex items-center px-8 py-2.5 rounded-full bg-peach-main text-terracotta font-sans font-extrabold text-sm hover:bg-terracotta hover:text-white shadow-sm hover:shadow-md transition-all duration-300"
                            >
                                Log In
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

