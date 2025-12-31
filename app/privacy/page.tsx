'use client';

import Link from 'next/link';

export default function PrivacyPage() {
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
                <h1 className="text-4xl font-serif font-bold text-text-primary mb-4">Privacy Policy</h1>
                <p className="text-sm text-text-secondary mb-8">Last updated: December 2024</p>

                <div className="prose prose-lg prose-amber space-y-6">
                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">1. Information We Collect</h2>
                        <p className="text-text-secondary leading-relaxed">
                            We collect information you provide directly, including voice recordings, written stories,
                            and account information. We also collect usage data to improve our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">2. How We Use Your Information</h2>
                        <p className="text-text-secondary leading-relaxed">
                            Your stories are processed by our AI to create personalized content. We never sell your
                            personal information and only use it to provide and improve Evermore services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">3. Data Security</h2>
                        <p className="text-text-secondary leading-relaxed">
                            We use industry-standard encryption and security measures to protect your stories.
                            Your data is stored securely and backed up regularly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">4. Your Rights</h2>
                        <p className="text-text-secondary leading-relaxed">
                            You can access, export, or delete your data at any time. Contact us at
                            <a href="mailto:privacy@evermore.ai" className="text-terracotta hover:underline ml-1">privacy@evermore.ai</a>
                            for data requests.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-text-primary mb-3">5. Contact</h2>
                        <p className="text-text-secondary leading-relaxed">
                            For privacy concerns, email us at <a href="mailto:privacy@evermore.ai" className="text-terracotta hover:underline">privacy@evermore.ai</a>
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
