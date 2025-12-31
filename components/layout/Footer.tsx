import React from 'react';
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="bg-white/50 border-t border-peach-main/10 py-8 mt-auto backdrop-blur-sm">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                        <span className="font-serif font-bold text-terracotta tracking-tight">Evermore</span>
                        <span className="hidden md:inline text-text-secondary/40">|</span>
                        <span className="text-sm text-text-secondary font-medium">Preserving family stories for generations.</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <p className="text-xs font-medium text-text-secondary/60">
                            © {new Date().getFullYear()} Evermore
                        </p>
                        <div className="flex items-center gap-4 border-l border-peach-main/10 pl-6 py-1">
                            <Link href="/help" className="text-xs font-bold text-text-secondary hover:text-terracotta transition-colors uppercase tracking-wider">Help</Link>
                            <Link href="/privacy" className="text-xs font-bold text-text-secondary hover:text-terracotta transition-colors uppercase tracking-wider">Privacy</Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}


