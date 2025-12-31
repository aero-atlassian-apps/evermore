import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function MarketingHero() {
    return (
        <section className="relative pt-32 md:pt-44 pb-20 md:pb-32 overflow-hidden bg-background-cream">
            <div className="container mx-auto px-6">
                <div className="grid lg:grid-cols-2 items-center gap-12 lg:gap-20">

                    {/* Left Content Area */}
                    <div className="flex flex-col items-start space-y-8 md:space-y-10 animate-fade-in relative z-10">
                        {/* Status Pill */}
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-peach-main/50 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-orange-warm mr-3 animate-pulse"></span>
                            <span className="text-[11px] font-bold text-text-secondary tracking-widest uppercase">NEW: VOICE TO BOOK</span>
                        </div>

                        {/* Large Warm Heading */}
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-extrabold text-text-primary leading-[1.1] md:leading-[1.05]">
                            Preserve your family's <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-terracotta to-orange-warm">priceless stories</span>
                        </h1>

                        {/* Soft Description */}
                        <p className="text-xl text-text-secondary font-sans font-medium leading-[1.6] max-w-xl">
                            The simple, comforting way for seniors to record memories through conversation. We turn voices into cherished family books.
                        </p>

                        {/* Primary Action - Pill Gradient */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                            <Link
                                href="/onboarding"
                                className="group px-10 py-5 bg-gradient-to-r from-terracotta to-orange-warm text-white rounded-full shadow-xl shadow-terracotta/20 hover:shadow-2xl hover:shadow-terracotta/30 transition-all duration-500 hover:scale-[1.02] flex items-center gap-3 relative overflow-hidden"
                            >
                                <span className="font-extrabold text-xl relative z-10">Get Started Free</span>
                                <span className="material-symbols-outlined text-2xl relative z-10 group-hover:translate-x-2 transition-transform">arrow_forward</span>
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            </Link>
                        </div>

                        {/* Trust & Social Proof */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 pt-6 bg-peach-light/30 p-6 rounded-[2.5rem] border border-peach-main/20">
                            <div className="flex -space-x-4">
                                {[
                                    '/images/avatar_1.png',
                                    '/images/avatar_2.png',
                                    '/images/avatar_3.png'
                                ].map((src, i) => (
                                    <div key={i} className="w-14 h-14 rounded-full border-4 border-white shadow-sm overflow-hidden relative">
                                        <Image
                                            src={src}
                                            alt="Happy User"
                                            fill
                                            className="object-cover"
                                        />
                                    </div >
                                ))}
                                <div className="w-14 h-14 rounded-full border-4 border-white bg-peach-main flex items-center justify-center text-[10px] font-bold text-terracotta shadow-sm">
                                    +2k
                                </div>
                            </div >

                            <div className="flex flex-col items-center sm:items-start">
                                <div className="flex gap-1 mb-1">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <span key={s} className="material-symbols-outlined text-orange-warm text-xl filled">star</span>
                                    ))}
                                </div>
                                <span className="text-sm text-text-secondary font-bold font-sans">Trusted by 2,000+ happy families</span>
                            </div>
                        </div >
                    </div >

                    {/* Right Media Area - Large Cozy Illustration */}
                    <div className="relative group perspective-1000" >
                        <div className="relative rounded-[4rem] overflow-hidden shadow-2xl shadow-terracotta/10 border-8 border-white bg-white transition-all duration-700 hover:rotate-2 hover:scale-[1.02]">
                            <Image
                                src="/images/hero_grandma.png"
                                alt="Cozy storyteller family moment"
                                width={1000}
                                height={800}
                                className="w-full h-auto object-cover transform transition-transform duration-1000 group-hover:scale-105"
                                priority
                            />

                            {/* Glass Play Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-24 h-24 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-2xl">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                                        <span className="material-symbols-outlined text-orange-warm text-4xl filled translate-x-1">play_arrow</span>
                                    </div>
                                </div>
                            </div>

                            {/* Frosted Bottom Bar */}
                            <div className="absolute bottom-10 left-10 right-10 bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/40 flex justify-between items-center transition-all group-hover:bottom-12 cursor-pointer">
                                <div>
                                    <h4 className="text-text-primary font-bold text-lg mb-0.5">See how it works</h4>
                                    <p className="text-text-secondary text-xs font-medium">1 min demo video</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-terracotta">
                                    <span className="material-symbols-outlined text-xl font-bold">arrow_forward</span>
                                </div>
                            </div>
                        </div>

                        {/* Decorative Blob */}
                        <div className="absolute -z-10 -top-20 -right-20 w-80 h-80 bg-peach-main/50 rounded-full blur-[100px] animate-pulse"></div>
                        <div className="absolute -z-10 -bottom-20 -left-20 w-80 h-80 bg-terracotta/10 rounded-full blur-[100px] animate-pulse"></div>
                    </div >

                </div >
            </div >
        </section >
    );
}
