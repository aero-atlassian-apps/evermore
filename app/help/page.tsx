'use client';

import Link from 'next/link';

export default function HelpPage() {
    const faqs = [
        {
            q: "How do I start recording my stories?",
            a: "After logging in, go to 'Start Conversation' from your dashboard. Speak naturally and our AI companion will guide you through sharing your memories."
        },
        {
            q: "Can I edit my stories after they're created?",
            a: "Yes! All stories can be edited from the Stories page. Click on any story to view and make changes."
        },
        {
            q: "How do I share stories with family members?",
            a: "Each story has a Share button. You can invite family members via email or generate a shareable link."
        },
        {
            q: "Is my data secure?",
            a: "Absolutely. We use industry-standard encryption and never sell your personal information. See our Privacy Policy for details."
        },
        {
            q: "Can I export my storybooks?",
            a: "Yes! Every storybook can be downloaded as a PDF for printing or sharing offline."
        }
    ];

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
                <h1 className="text-4xl font-serif font-bold text-text-primary mb-4">Help Center</h1>
                <p className="text-lg text-text-secondary mb-12">
                    Find answers to common questions about Evermore.
                </p>

                <div className="space-y-6">
                    {faqs.map((faq, i) => (
                        <details key={i} className="group bg-white rounded-2xl border border-peach-main/20 overflow-hidden">
                            <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-text-primary hover:bg-peach-main/5">
                                <span>{faq.q}</span>
                                <span className="material-symbols-outlined text-terracotta group-open:rotate-180 transition-transform">
                                    expand_more
                                </span>
                            </summary>
                            <div className="px-6 pb-6 text-text-secondary leading-relaxed">
                                {faq.a}
                            </div>
                        </details>
                    ))}
                </div>

                <div className="mt-12 p-8 bg-white rounded-2xl border border-peach-main/20 text-center">
                    <h2 className="text-xl font-bold text-text-primary mb-2">Still need help?</h2>
                    <p className="text-text-secondary mb-4">Our support team is here for you.</p>
                    <Link
                        href="/contact"
                        className="inline-block bg-terracotta text-white font-bold px-8 py-3 rounded-xl hover:bg-terracotta/90 transition-all"
                    >
                        Contact Support
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 border-t border-peach-main/10 text-center text-sm text-text-secondary">
                <p>© 2024 Evermore. All rights reserved.</p>
            </footer>
        </div>
    );
}
