'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface ChapterData {
    id: string;
    title: string;
    content: string;
    createdAt: string;
}

export default function BookPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [story, setStory] = useState<ChapterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchChapter() {
            try {
                const res = await fetch(`/api/chapters/detail/${resolvedParams.id}`);
                if (!res.ok) throw new Error('Chapter not found');
                const data = await res.json();
                setStory(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load story');
            } finally {
                setLoading(false);
            }
        }
        fetchChapter();
    }, [resolvedParams.id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading story...</div>
            </div>
        );
    }

    if (error || !story) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
                <p className="text-red-500 mb-4">{error || 'Story not found'}</p>
                <Link href="/stories" className="text-blue-500 underline">Back to Stories</Link>
            </div>
        );
    }

    const formattedDate = new Date(story.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <>
            {/* Print-only styles */}
            <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { 
            font-family: 'Georgia', serif;
            background: white !important;
          }
          @page {
            margin: 1in;
            size: letter;
          }
        }
      `}</style>

            <div className="min-h-screen bg-stone-50">
                {/* Print Control Bar - Hidden when printing */}
                <div className="no-print bg-white border-b border-stone-200 sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-8 py-4 flex justify-between items-center">
                        <Link
                            href={`/stories/${resolvedParams.id}`}
                            className="text-stone-500 hover:text-stone-700 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                            Back to Story
                        </Link>
                        <button
                            onClick={handlePrint}
                            className="bg-stone-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-stone-800 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-xl">print</span>
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Book Page Content */}
                <div className="max-w-4xl mx-auto px-8 py-16 bg-white min-h-screen shadow-xl">

                    {/* Decorative Header */}
                    <div className="text-center mb-16">
                        <div className="flex justify-center mb-8">
                            <div className="w-24 h-1 bg-stone-300 rounded-full" />
                        </div>
                        <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-4 leading-tight">
                            {story.title || 'A Family Memory'}
                        </h1>
                        <p className="text-stone-500 font-serif italic text-lg">
                            Recorded on {formattedDate}
                        </p>
                        <div className="flex justify-center mt-8">
                            <div className="w-24 h-1 bg-stone-300 rounded-full" />
                        </div>
                    </div>

                    {/* Story Content */}
                    <div className="font-serif text-lg md:text-xl text-stone-800 leading-relaxed space-y-6">
                        {story.content?.split('\n\n').map((paragraph, idx) => {
                            // Handle markdown-style headers
                            if (paragraph.startsWith('## ')) {
                                return (
                                    <h2 key={idx} className="font-bold text-2xl mt-12 mb-4 text-stone-900">
                                        {paragraph.replace('## ', '')}
                                    </h2>
                                );
                            }
                            // Handle emphasized text (italic)
                            const processedText = paragraph.replace(/\*([^*]+)\*/g, '<em>$1</em>');
                            return (
                                <p
                                    key={idx}
                                    className="text-justify first-letter:text-4xl first-letter:font-bold first-letter:mr-1 first-letter:float-left"
                                    dangerouslySetInnerHTML={{ __html: processedText }}
                                />
                            );
                        }) || <p className="italic text-stone-400">No content available.</p>}
                    </div>

                    {/* Footer */}
                    <div className="mt-24 text-center border-t border-stone-200 pt-12">
                        <p className="text-stone-400 font-serif text-sm">
                            A treasured memory preserved by Evermore
                        </p>
                        <div className="flex justify-center mt-4">
                            <div className="w-16 h-1 bg-stone-200 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
