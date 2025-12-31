'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface StoryCardProps {
    title: string;
    narrator: string;
    date: string;
    excerpt: string;
    imageUrl: string;
}

export function StoryCard({ title, narrator, date, excerpt, imageUrl }: StoryCardProps) {
    return (
        <motion.div
            whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(214, 141, 91, 0.12)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group bg-white rounded-3xl shadow-sm border border-gold/10 overflow-hidden cursor-pointer flex flex-col h-full"
        >
            {/* Image Section */}
            <div className="relative aspect-[16/10] overflow-hidden bg-gold/5">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full"
                >
                    <Image
                        src={imageUrl}
                        alt={title}
                        fill
                        className="object-cover"
                    />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-text-primary/40 to-transparent opacity-60"></div>

                {/* Narrator Badge */}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-text-primary uppercase tracking-widest border border-gold/10">
                    {narrator}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 flex flex-col flex-grow">
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-2">{date}</p>
                    <h2 className="text-xl font-serif font-bold text-text-primary group-hover:text-terracotta transition-colors leading-tight line-clamp-2">
                        {title}
                    </h2>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-6 flex-grow font-sans">
                    {excerpt}
                </p>

                {/* Actions Section */}
                <div className="flex justify-between items-center pt-5 border-t border-gold/5">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-4 py-2 bg-background-cream hover:bg-gold/10 border border-gold/20 rounded-full text-xs font-bold text-text-secondary hover:text-terracotta transition-all duration-300"
                    >
                        <span className="material-symbols-outlined text-base">play_arrow</span>
                        Listen
                    </motion.button>

                    <div className="flex items-center gap-2">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gold/10 text-text-muted hover:text-terracotta transition-all"
                            title="Edit story"
                        >
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gold/10 text-text-muted hover:text-terracotta transition-all"
                            title="Share story"
                        >
                            <span className="material-symbols-outlined text-lg">share</span>
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

