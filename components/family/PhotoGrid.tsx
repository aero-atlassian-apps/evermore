'use client';

import React from 'react';
import Link from 'next/link';

interface PhotoGridProps {
    chapters: { id: string, coverImage?: string, title: string }[];
}

export function PhotoGrid({ chapters }: PhotoGridProps) {
    const photos = chapters.filter(c => c.coverImage).slice(0, 4);

    return (
        <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold font-serif text-[#3D3430]">Recent Photos</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {photos.map((chapter) => (
                    <div key={chapter.id} className="space-y-1">
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#3D3430]/10 relative group">
                            <img src={chapter.coverImage} alt={chapter.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                        </div>
                        <p className="text-xs font-medium text-[#5C4D44] truncate pl-1">{chapter.title}</p>
                    </div>
                ))}

                {photos.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-[#756A63] italic bg-[#EAE0D5]/30 rounded-2xl border border-dashed border-[#D6C5B3]">
                        No photos found recently.
                    </div>
                )}
            </div>

            <div className="mt-4 text-right">
                <Link href="#" className="text-[#3D3430] font-bold text-sm border-b-2 border-[#3D3430]">View All</Link>
            </div>
        </div>
    );
}
