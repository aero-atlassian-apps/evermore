'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Chapter {
    id: string;
    title: string;
    coverImage?: string;
    createdAt: string;
    summary?: string;
}

interface LatestUpdatesProps {
    chapters: Chapter[];
    loading?: boolean;
}

export function LatestUpdates({ chapters, loading }: LatestUpdatesProps) {
    if (loading) return <div>Loading updates...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold font-serif text-[#3D3430] mb-6">Latest Updates</h2>

            <div className="space-y-4">
                {chapters.length === 0 ? (
                    <p className="text-[#756A63] italic">No updates yet.</p>
                ) : (
                    chapters.slice(0, 3).map((chapter, index) => (
                        <Link href={`/chapter/${chapter.id}`} key={chapter.id}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative flex items-center gap-6 p-4 rounded-3xl bg-gradient-to-r from-[#E0A885] to-[#E6CCB3] hover:from-[#D99A75] hover:to-[#DFC0A5] transition-all cursor-pointer shadow-sm hover:shadow-md border border-[#E07A5F]/10 overflow-hidden"
                            >
                                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-inner border border-white/20 shrink-0 bg-[#3D3430]/10">
                                    {chapter.coverImage ? (
                                        <img src={chapter.coverImage} alt={chapter.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[#3D3430]/40 text-3xl">menu_book</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-[#3D3430] font-display mb-1 group-hover:underline decoration-[#3D3430]/30">{chapter.title}</h3>
                                    <p className="text-[#5C4D44] text-sm font-medium">Added recently</p>
                                </div>

                            </motion.div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
