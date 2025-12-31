'use client';

import Link from 'next/link';

export default function TermsPage() {
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
                <h1 className="text-4xl font-serif font-bold text-text-primary mb-4">Terms of Service</h1>
                <p className="text-sm text-text-secondary mb-8">Last updated: December 2024</p>

                <div className="prose prose-lg prose-amber space-y-6">
                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">1. Acceptance of Terms</h2>
                        <p className="text-text-secondary leading-relaxed">
                            By using Evermore, you agree to these terms. If you don't agree, please don't use our service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">2. Your Content</h2>
                        <p className="text-text-secondary leading-relaxed">
                            You retain ownership of all stories and content you create. By using Evermore, you grant
                            us permission to process your content to provide our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">3. Acceptable Use</h2>
                        <p className="text-text-secondary leading-relaxed">
                            Use Evermore responsibly. Don't upload content that violates laws or infringes on others' rights.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">4. Service Availability</h2>
                        <p className="text-text-secondary leading-relaxed">
                            We strive for 99.9% uptime but can't guarantee uninterrupted service. We may update or
                            modify features as we improve Evermore.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">5. Contact</h2>
                        <p className="text-text-secondary leading-relaxed">
                            Questions about these terms? Email <a href="mailto:legal@evermore.ai" className="text-terracotta hover:underline">legal@evermore.ai</a>
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 border-t border-peach-main/10 text-center text-sm text-text-secondary">
                <p>© 2024 Evermore. All rights reserved.</p>
            </footer>
        </div>
    );
}
