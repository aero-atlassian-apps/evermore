'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const features = [
    {
        title: "Chat Naturally",
        description: "Grandma chats comfortably with our friendly AI voice companion, sharing her favorite moments.",
        icon: "mic",
        color: "bg-[#E07A5F]",
        textColor: "text-[#E07A5F]",
        bg: "bg-[#E07A5F]/10",
        className: "md:col-span-1"
    },
    {
        title: "Beautifully Written",
        description: "We turn spoken words into professionally written narrative chapters, ready for print.",
        icon: "auto_stories",
        color: "bg-[#F2CC8F]",
        textColor: "text-orange-600",
        bg: "bg-[#F2CC8F]/20",
        className: "md:col-span-1"
    },
    {
        title: "Family Forever",
        description: "Share the digital book with the whole family. Everyone gets updates as stories unfold.",
        icon: "diversity_3",
        color: "bg-blue-400",
        textColor: "text-blue-500",
        bg: "bg-blue-100",
        className: "md:col-span-2"
    }
];

export function Features() {
    return (
        <section className="py-24 px-4 relative z-10">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="text-[#E07A5F] font-bold text-sm tracking-widest uppercase mb-4 block">How It Works</span>
                    <h2 className="text-4xl md:text-5xl font-display font-bold text-[#3D3430] mb-6">Three simple steps to forever</h2>
                    <p className="text-[#756A63] max-w-2xl mx-auto text-lg">We've designed Evermore to be incredibly easy to use, focusing on voice and conversation rather than typing.</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, i) => (
                        <FeatureCard key={i} feature={feature} index={i} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function FeatureCard({ feature, index }: { feature: any, index: number }) {
    return (
        <motion.div
            className={cn(
                "group relative overflow-hidden rounded-[2rem] p-8 border border-white/60 bg-white/40 backdrop-blur-md shadow-sm transition-all hover:bg-white/60 hover:shadow-xl",
                feature.className
            )}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -5 }}
        >
            <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-500", feature.color)} />

            <div className="relative z-10 flex flex-col items-start gap-6">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", feature.bg)}>
                    <span className={cn("material-symbols-outlined text-[32px]", feature.textColor)}>{feature.icon}</span>
                </div>

                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={cn("flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold", feature.bg, feature.textColor)}>{index + 1}</span>
                        <h3 className="text-xl font-bold text-[#3D3430]">{feature.title}</h3>
                    </div>
                    <p className="text-[#756A63] leading-relaxed">{feature.description}</p>
                </div>
            </div>
        </motion.div>
    );
}
