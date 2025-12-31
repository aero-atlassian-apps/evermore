'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

const fadeUpVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1] as const,
        },
    }),
};

export function Hero() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"],
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <section ref={containerRef} className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
            <div className="container px-4 mx-auto grid lg:grid-cols-2 gap-12 items-center">
                {/* Left Content */}
                <div className="flex flex-col gap-8 text-center lg:text-left z-10">
                    <motion.div
                        custom={0}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUpVariant}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-[#E07A5F]/20 backdrop-blur-sm shadow-sm mx-auto lg:mx-0">
                            <span className="flex h-2 w-2 rounded-full bg-[#E07A5F] animate-pulse"></span>
                            <span className="text-xs font-semibold text-[#E07A5F] uppercase tracking-wide">New: Voice to Book</span>
                        </div>
                    </motion.div>

                    <motion.h1
                        className="text-5xl sm:text-6xl md:text-7xl font-display font-bold leading-[1.1] tracking-tight text-[#3D3430]"
                        custom={1}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUpVariant}
                    >
                        Preserve your family's <br />
                        <span className="text-[#E07A5F] relative">
                            priceless stories
                            <motion.svg
                                className="absolute w-full h-3 -bottom-1 left-0 text-[#F2CC8F] -z-10"
                                viewBox="0 0 100 10"
                                preserveAspectRatio="none"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 0.8, duration: 1, ease: "easeInOut" }}
                            >
                                <motion.path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                            </motion.svg>
                        </span>
                    </motion.h1>

                    <motion.p
                        className="text-lg md:text-xl text-[#756A63] max-w-lg mx-auto lg:mx-0 leading-relaxed"
                        custom={2}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUpVariant}
                    >
                        The simple, comforting way for seniors to record memories through conversation. We turn voices into cherished family books.
                    </motion.p>

                    <motion.div
                        className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
                        custom={3}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUpVariant}
                    >
                        <Link href="/onboarding">
                            <motion.button
                                className="group relative px-8 py-4 rounded-full bg-[#E07A5F] text-white text-lg font-bold shadow-xl shadow-[#E07A5F]/25 overflow-hidden"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                <span className="relative flex items-center gap-2">
                                    Get Started Free
                                    <span className="material-symbols-outlined text-[24px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </span>
                            </motion.button>
                        </Link>

                        <div className="flex items-center gap-[-0.5rem]">
                            {/* Social proof avatars could go here but let's keep it clean for now or add them back if user insists */}
                            <span className="text-sm font-medium text-[#756A63] px-4">Trusted by 2,000+ families</span>
                        </div>
                    </motion.div>
                </div>

                {/* Right Content - Visual */}
                <motion.div
                    style={{ y, opacity }}
                    className="relative w-full aspect-square md:aspect-[4/3] max-w-[600px] mx-auto z-0"
                >
                    {/* Main Image Container */}
                    <motion.div
                        className="absolute inset-4 rounded-[2.5rem] overflow-hidden shadow-2xl border-[8px] border-white/50 backdrop-blur-sm"
                        initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    >
                        <div className="absolute inset-0 bg-stone-200 animate-pulse" /> {/* Placeholder while loading */}
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCt87K7-ogtEOOARQA70qdjb1gfH-U1oynox5wf-RKi1ihtPnX4IUqHPKf7SqvGtdkxyaH3I8n3kMXGFRFXUyCeGnp5-tQDgWkrsVdiXZVuAiHp2cJMo-8ZJ8B_7gRFINLP1cCS8wossmjSH3j-KrWj67hzGSuFjB7DIoQBDsyg8RsZyykfPpv9V2TWol_NfP6_5XWI52kScB3YFi96Ab7Y32bjO1LT2jTlUkawLkHPPqvWLQtVpM_9apORe4924jlPQUYCG-P9Dyg"
                            alt="Grandmother reading to child"
                            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-1000"
                        />
                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/40">
                                <span className="material-symbols-outlined text-white text-4xl drop-shadow-md">play_arrow</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Floating Elements (Parallax) */}
                    <FloatingBadge
                        text="Grandma's 80th"
                        className="top-10 -left-4 md:-left-12 rotate-[-6deg]"
                        delay={0.5}
                    />
                    <FloatingBadge
                        text="The Old House"
                        className="bottom-20 -right-4 md:-right-8 rotate-[3deg]"
                        delay={0.7}
                    />
                    <FloatingImage
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1CcxpqLmDicTG3o-BsW2FGv2ZsAE-GqhGFMabPjJ73tKWxMIWBMkMLsMCnUD2p8FKKX4nHMcUgyJjqbJCFIxZ2mzOawLO-p1iPwBN07qZ2vKQOxyht_9ifB9t5nV44Sf290smlyARz-q_H7Gt1g5rDt5Tf0xApcS61Y9UvWQ2yZ4ghyEPqH-L_DS4OouG4142cXiQXM1jw14OxmUoXFS1xuaCdC4hsXeM35bD5rwm8A0IwWNkOqnogMhft9AspVqR_ui92r4lOew"
                        className="top-[-20px] right-10 md:right-20 w-16 h-16 md:w-20 md:h-20"
                        delay={0.9}
                    />
                </motion.div>
            </div>
        </section>
    );
}

function FloatingBadge({ text, className, delay }: { text: string; className?: string; delay: number }) {
    return (
        <motion.div
            className={cn("absolute bg-white px-4 py-2 rounded-xl shadow-lg border border-stone-100 text-sm font-bold text-[#3D3430] z-20", className)}
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 200, damping: 15 }}
            whileHover={{ scale: 1.1, rotate: 0, zIndex: 30 }}
        >
            <span className="text-[#E07A5F]">♥</span> {text}
        </motion.div>
    );
}

function FloatingImage({ src, className, delay }: { src: string; className?: string; delay: number }) {
    return (
        <motion.div
            className={cn("absolute rounded-full border-4 border-white shadow-lg overflow-hidden z-20", className)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay, type: "spring", stiffness: 200, damping: 15 }}
            whileHover={{ scale: 1.2, zIndex: 30 }}
        >
            <img src={src} alt="" className="w-full h-full object-cover" />
        </motion.div>
    )
}


