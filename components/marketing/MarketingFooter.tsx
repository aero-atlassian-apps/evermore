import React from 'react';
import Link from 'next/link';

export function MarketingFooter() {
    return (
        <footer className="bg-peach-light/50 border-t border-peach-main/20 pt-24 pb-12">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20 border-b border-peach-main/10 pb-20">

                    {/* Brand Section */}
                    <div className="space-y-8">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm transform group-hover:rotate-6 transition-transform">
                                <span className="material-symbols-outlined text-white text-2xl filled">heart_plus</span>
                            </div>
                            <span className="text-2xl font-serif font-extrabold text-text-primary tracking-tight">Evermore</span>
                        </Link>
                        <p className="text-text-secondary text-sm font-medium leading-relaxed max-w-xs">
                            Immortalizing family stories, one conversation at a time. We help you preserve legacies for future generations in beautiful, physical books.
                        </p>
                    </div>

                    {/* Navigation Columns */}
                    <div>
                        <h4 className="text-[11px] font-bold text-terracotta uppercase tracking-[0.2em] mb-10">Links</h4>
                        <ul className="space-y-5">
                            <li><Link href="/" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Home</Link></li>
                            <li><Link href="#how-it-works" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">How It Works</Link></li>
                            <li><Link href="#pricing" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Pricing</Link></li>
                            <li><Link href="#about" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">About Evermore</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-bold text-terracotta uppercase tracking-[0.2em] mb-10">Resources</h4>
                        <ul className="space-y-5">
                            <li><Link href="/help" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Legacy Guide</Link></li>
                            <li><Link href="/privacy" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Privacy Commitment</Link></li>
                            <li><Link href="/terms" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Terms of Service</Link></li>
                            <li><Link href="/faq" className="text-text-primary font-bold hover:text-terracotta transition-all text-sm">Common Questions</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-10">
                        <div>
                            <h4 className="text-[11px] font-bold text-terracotta uppercase tracking-[0.2em] mb-8">Social Media</h4>
                            <div className="flex items-center gap-4">
                                {['facebook', 'instagram', 'youtube'].map((social) => (
                                    <a
                                        key={social}
                                        href="#"
                                        className="w-12 h-12 rounded-full bg-white border border-peach-main/50 flex items-center justify-center text-terracotta hover:bg-terracotta hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-xl">{social}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[11px] font-bold text-terracotta uppercase tracking-[0.2em] mb-6">Copyright</h4>
                            <p className="text-text-secondary text-xs font-bold leading-relaxed">
                                © 2024 Evermore Legacy Inc. <br />
                                All Rights Reserved
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-8">
                        <Link href="/privacy" className="text-text-secondary hover:text-terracotta font-bold text-xs transition-colors tracking-widest uppercase">Privacy</Link>
                        <Link href="/terms" className="text-text-secondary hover:text-terracotta font-bold text-xs transition-colors tracking-widest uppercase">Terms</Link>
                        <Link href="/contact" className="text-text-secondary hover:text-terracotta font-bold text-xs transition-colors tracking-widest uppercase">Contact</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-text-primary flex items-center justify-center text-white font-serif font-extrabold text-[10px]">R</div>
                        <span className="text-[10px] font-bold text-text-muted tracking-[0.25em] uppercase">Part of the Uncraivgned Legacy Circle</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

