'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-[#FCF8F3] flex flex-col font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-peach-main/10 h-16 flex items-center">
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-peach-warm to-terracotta rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-lg filled">mic</span>
                        </div>
                        <span className="text-xl font-serif font-bold text-terracotta">Evermore</span>
                    </Link>
                    <Link href="/" className="text-sm font-bold text-terracotta hover:underline">← Back Home</Link>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 container mx-auto px-6 py-16 max-w-2xl">
                <h1 className="text-4xl font-serif font-bold text-text-primary mb-4">Contact Us</h1>
                <p className="text-lg text-text-secondary mb-8">
                    We'd love to hear from you. Reach out with questions, feedback, or just to say hello.
                </p>

                {submitted ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                        <span className="material-symbols-outlined text-green-600 text-4xl mb-4">check_circle</span>
                        <h2 className="text-2xl font-bold text-green-800 mb-2">Thank You!</h2>
                        <p className="text-green-700">We'll get back to you soon.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-text-primary mb-2">Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-peach-main/30 bg-white focus:ring-2 focus:ring-terracotta focus:border-transparent outline-none"
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-primary mb-2">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-peach-main/30 bg-white focus:ring-2 focus:ring-terracotta focus:border-transparent outline-none"
                                placeholder="your@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-text-primary mb-2">Message</label>
                            <textarea
                                required
                                rows={5}
                                className="w-full px-4 py-3 rounded-xl border border-peach-main/30 bg-white focus:ring-2 focus:ring-terracotta focus:border-transparent outline-none resize-none"
                                placeholder="How can we help?"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-terracotta hover:bg-terracotta/90 text-white font-bold py-4 rounded-xl transition-all"
                        >
                            Send Message
                        </button>
                    </form>
                )}

                <div className="mt-12 text-center text-text-secondary">
                    <p className="mb-2">Or email us directly:</p>
                    <a href="mailto:hello@evermore.ai" className="text-terracotta font-bold hover:underline">
                        hello@evermore.ai
                    </a>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 border-t border-peach-main/10 text-center text-sm text-text-secondary">
                <p>© 2024 Evermore. All rights reserved.</p>
            </footer>
        </div>
    );
}
