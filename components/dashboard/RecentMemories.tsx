'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Chapter {
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    durationMinutes?: number;
}

interface RecentMemoriesProps {
    chapters: Chapter[];
    loading: boolean;
}

export function RecentMemories({ chapters, loading }: RecentMemoriesProps) {
    // Format relative time helper
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="mt-4 flex flex-col gap-5 z-10 w-full max-w-lg mx-auto pb-10">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-bold font-display text-[#3D3430] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#E07A5F] filled">auto_stories</span>
                    Recent Memories
                </h3>
                <Link href="/family" className="text-[#E07A5F] font-bold text-sm hover:bg-[#E07A5F]/10 px-3 py-1 rounded-full transition-all">
                    View All
                </Link>
            </div>

            <div className="flex flex-col gap-4">
                {loading ? (
                    [1, 2].map((i) => (
                        <div key={i} className="flex items-center p-5 bg-white/60 rounded-3xl border border-white/60 shadow-sm animate-pulse">
                            <div className="w-16 h-16 rounded-2xl bg-[#E07A5F]/10 shrink-0 mr-5"></div>
                            <div className="flex-1">
                                <div className="h-5 bg-[#E07A5F]/10 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))
                ) : chapters.length > 0 ? (
                    chapters.slice(0, 3).map((chapter, index) => (
                        <motion.div
                            key={chapter.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Link
                                href={`/chapter/${chapter.id}`}
                                className="group flex items-center p-4 bg-white/80 backdrop-blur-sm hover:bg-white rounded-3xl shadow-sm hover:shadow-lg border border-white/60 hover:border-[#E07A5F]/30 transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${index % 2 === 0 ? 'bg-[#F2CC8F]/20' : 'bg-[#E07A5F]/10'} shrink-0 mr-5 shadow-inner border border-black/5 overflow-hidden`}>
                                    <div className={`absolute inset-0 opacity-20 bg-black/5`}></div>
                                    <span className={`material-symbols-outlined text-3xl ${index % 2 === 0 ? 'text-[#D4A353]' : 'text-[#E07A5F]'}`}>
                                        {index % 2 === 0 ? 'menu_book' : 'bookmark'}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0 pr-2">
                                    <h4 className="text-lg font-bold text-[#3D3430] truncate group-hover:text-[#E07A5F] transition-colors">
                                        {chapter.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-semibold text-[#756A63] bg-[#756A63]/5 px-2 py-0.5 rounded-md">
                                            {getRelativeTime(chapter.createdAt)}
                                        </span>
                                        {chapter.durationMinutes && (
                                            <span className="text-xs text-[#756A63]">
                                                • {chapter.durationMinutes} min listen
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#FDFCF8] border border-[#E07A5F]/10 text-[#E07A5F] group-hover:bg-[#E07A5F] group-hover:text-white transition-all shadow-sm">
                                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                                </div>
                            </Link>
                        </motion.div>
                    ))
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-10 bg-white/50 rounded-3xl border border-dashed border-[#756A63]/20"
                    >
                        <div className="w-16 h-16 bg-[#FDFCF8] rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <span className="material-symbols-outlined text-[#756A63]/40 text-3xl">library_books</span>
                        </div>
                        <p className="text-[#3D3430] font-medium">No stories recorded yet</p>
                        <p className="text-[#756A63] text-sm mt-1 max-w-xs mx-auto">Your family history book is waiting for its first chapter.</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
