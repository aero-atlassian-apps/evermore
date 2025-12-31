import React from 'react';
import { BackgroundBlobs } from '@/components/ui/BackgroundBlobs';
import { Header } from './Header';
import { Footer } from './Footer';

interface AppShellProps {
    children: React.ReactNode;
    userType?: 'senior' | 'family';
    userName?: string;
    showNav?: boolean;
}

export function AppShell({
    children,
    userType = 'senior',
    userName,
    showNav = true
}: AppShellProps) {
    return (
        <div className="min-h-[100dvh] bg-background-cream flex flex-col font-sans overflow-x-hidden" id="root">
            {/* Header */}
            {showNav && <Header />}

            {/* Main Content Area - Added pt-20 to account for fixed header (h-20) */}
            <main className={`flex-grow container mx-auto px-4 md:px-8 py-6 md:py-12 pb-safe w-full ${showNav ? 'pt-24' : ''}`}>
                {children}
            </main>

            {/* Footer */}
            {showNav && <Footer />}
        </div>
    );
}
