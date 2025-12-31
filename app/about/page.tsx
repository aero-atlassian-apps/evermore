'use client';

import Link from 'next/link';

export default function AboutPage() {
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
            <main className="flex-1 container mx-auto px-6 py-16 max-w-3xl">
                <h1 className="text-4xl font-serif font-bold text-text-primary mb-8">About Evermore</h1>

                <div className="prose prose-lg prose-amber">
                    <p className="text-xl text-text-secondary leading-relaxed mb-6">
                        <strong>Evermore</strong> is an Agentic AI Biographer designed for seniors and their families.
                        We help you capture, preserve, and share life stories through the power of voice.
                    </p>

                    <h2 className="text-2xl font-serif font-bold text-text-primary mt-8 mb-4">Our Mission</h2>
                    <p className="text-text-secondary leading-relaxed mb-6">
                        Every family has stories worth preserving. Evermore makes it effortless to turn conversations
                        into beautiful, illustrated storybooks that can be treasured for generations.
                    </p>

                    <h2 className="text-2xl font-serif font-bold text-text-primary mt-8 mb-4">How It Works</h2>
                    <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-6">
                        <li><strong>Talk naturally</strong> — Share memories through voice conversations</li>
                        <li><strong>AI transforms</strong> — Our agentic AI crafts your stories</li>
                        <li><strong>Preserve forever</strong> — Get illustrated storybooks and audio narration</li>
                    </ul>

                    <h2 className="text-2xl font-serif font-bold text-text-primary mt-8 mb-4">Contact</h2>
                    <p className="text-text-secondary">
                        Have questions? Reach us at <a href="mailto:hello@evermore.ai" className="text-terracotta hover:underline">hello@evermore.ai</a>
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 border-t border-peach-main/10 text-center text-sm text-text-secondary">
                <p>© 2024 Evermore. All rights reserved.</p>
            </footer>
        </div>
    );
}
