'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Story {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    createdAt: string;
}

function StorybookCreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [storybookTitle, setStorybookTitle] = useState('My Life Stories');
    const [error, setError] = useState('');

    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

    useEffect(() => {
        async function fetchSelectedStories() {
            if (ids.length === 0) {
                setLoading(false);
                return;
            }

            try {
                // Fetch each story by ID
                const storyPromises = ids.map(id =>
                    fetch(`/api/chapters/${id}`).then(res => res.ok ? res.json() : null)
                );
                const fetchedStories = await Promise.all(storyPromises);
                const validStories = fetchedStories.filter(Boolean);
                setStories(validStories);

                // Generate default title
                if (validStories.length === 1) {
                    setStorybookTitle(validStories[0].title || 'My Life Story');
                } else {
                    setStorybookTitle(`My Life Stories - ${validStories.length} Memories`);
                }
            } catch (err) {
                console.error('Error fetching stories:', err);
                setError('Failed to load selected stories');
            } finally {
                setLoading(false);
            }
        }

        fetchSelectedStories();
    }, []);

    const handleGenerate = async () => {
        if (stories.length === 0) return;

        setGenerating(true);
        setError('');

        try {
            // Call export API with selected story IDs
            const response = await fetch(`/api/storybooks/export?type=storybook&chapterIds=${ids.join(',')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: storybookTitle }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate storybook');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${storybookTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Navigate back to stories
            router.push('/stories');
        } catch (err: any) {
            console.error('Error generating storybook:', err);
            setError(err.message || 'Failed to generate storybook');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-terracotta to-peach-warm animate-pulse"></div>
                    <p className="text-lg font-bold text-text-muted">Loading your stories...</p>
                </div>
            </div>
        );
    }

    if (ids.length === 0 || stories.length === 0) {
        return (
            <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-terracotta mb-4">auto_stories</span>
                    <h1 className="text-3xl font-serif font-bold text-text-primary mb-4">No Stories Selected</h1>
                    <p className="text-text-muted mb-8">Go back and select at least one story to create your storybook.</p>
                    <Link href="/stories" className="inline-flex items-center gap-2 bg-terracotta text-white px-8 py-3 rounded-full font-bold hover:bg-terracotta/90 transition-all">
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to Stories
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FCF8F3]">
            {/* Header */}
            <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-peach-main/10 sticky top-0 z-50">
                <div className="container mx-auto px-6 h-full flex items-center justify-between">
                    <Link href="/stories" className="flex items-center gap-2 text-text-muted hover:text-terracotta transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="font-bold">Back to Stories</span>
                    </Link>
                    <h1 className="text-xl font-serif font-bold text-text-primary">Create Storybook</h1>
                    <div className="w-32"></div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-12 max-w-4xl">
                {/* Title Input */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-peach-warm/5 border border-peach-main/10 mb-8">
                    <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-3">
                        Storybook Title
                    </label>
                    <input
                        type="text"
                        value={storybookTitle}
                        onChange={(e) => setStorybookTitle(e.target.value)}
                        className="w-full text-3xl font-serif font-bold text-text-primary bg-transparent border-b-2 border-peach-main/20 focus:border-terracotta outline-none pb-2 transition-colors"
                        placeholder="Enter a title for your storybook"
                    />
                </div>

                {/* Selected Stories Preview */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-peach-warm/5 border border-peach-main/10 mb-8">
                    <h2 className="text-lg font-black uppercase tracking-widest text-text-muted mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-terracotta">menu_book</span>
                        Stories Included ({stories.length})
                    </h2>
                    <div className="space-y-4">
                        {stories.map((story, index) => (
                            <div key={story.id} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FCF8F3] border border-peach-main/10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-terracotta to-peach-warm flex items-center justify-center text-white font-bold">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-serif font-bold text-text-primary mb-1">{story.title || 'Untitled Memory'}</h3>
                                    <p className="text-sm text-text-muted line-clamp-2">{story.content?.substring(0, 150)}...</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
                        <span className="material-symbols-outlined text-red-500">error</span>
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* Generate Button */}
                <div className="text-center">
                    <button
                        onClick={handleGenerate}
                        disabled={generating || stories.length === 0}
                        className="inline-flex items-center gap-3 bg-gradient-to-r from-terracotta to-peach-warm text-white px-12 py-5 rounded-full font-bold text-xl shadow-2xl shadow-terracotta/30 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-2xl">
                            {generating ? 'hourglass_empty' : 'auto_stories'}
                        </span>
                        {generating ? 'Generating Storybook...' : 'Generate & Download PDF'}
                    </button>
                    <p className="text-sm text-text-muted mt-4">
                        This will create an illustrated storybook PDF with your selected stories.
                    </p>
                </div>
            </main>
        </div>
    );
}

export default function StorybookCreatePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-terracotta to-peach-warm animate-pulse"></div>
            </div>
        }>
            <StorybookCreateContent />
        </Suspense>
    );
}
