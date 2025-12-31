'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AudioPlayer } from '@/components/storybook/AudioPlayer';
import { ImmersiveViewer } from '@/components/storybook/ImmersiveViewer';

interface Scene {
    pageNumber: number;
    text: string;
    visualPrompt: string;
    imageUrl?: string;
    generatedImageUrl?: string;
}

interface StorybookData {
    id: string;
    title: string;
    scenes: Scene[];
    metadata: {
        characterName: string;
        timePeriod: string;
        totalPages: number;
    };
}

function StorybookReaderContent() {
    const params = useParams();
    const router = useRouter();
    const [storybook, setStorybook] = useState<StorybookData | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);
    const [isImmersive, setIsImmersive] = useState(false);
    const [vertexAIAvailable, setVertexAIAvailable] = useState<boolean | null>(null);

    const storybookId = params?.id as string;

    useEffect(() => {
        async function fetchStorybook() {
            if (!storybookId) return;

            let retries = 2;
            while (retries >= 0) {
                try {
                    const res = await fetch(`/api/storybooks/${storybookId}`);
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || 'Storybook not found');
                    }
                    const data = await res.json();

                    // Check if scenes are present
                    if (!data.scenes || data.scenes.length === 0) {
                        console.warn('Storybook has no scenes, may still be generating...');
                    }

                    setStorybook(data);
                    setLoading(false);
                    return;
                } catch (err: any) {
                    console.error('Error fetching storybook (retry ' + retries + '):', err);
                    if (retries === 0) {
                        setError(err.message || 'Failed to load storybook');
                        setLoading(false);
                    }
                    retries--;
                    if (retries >= 0) await new Promise(r => setTimeout(r, 2000));
                }
            }
        }

        async function checkHealth() {
            try {
                const res = await fetch('/api/vertexai/health');
                const data = await res.json();
                setVertexAIAvailable(data.available);
            } catch (e) {
                console.warn('Failed to check Vertex AI health:', e);
                setVertexAIAvailable(false);
            }
        }

        fetchStorybook();
        checkHealth();
    }, [storybookId]);

    const goToPage = (page: number) => {
        if (!storybook || isAnimating) return;
        if (page < 0 || page >= storybook.scenes.length) return;

        setIsAnimating(true);
        setTimeout(() => {
            setCurrentPage(page);
            setIsAnimating(false);
        }, 300);
    };

    const nextPage = () => goToPage(currentPage + 1);
    const prevPage = () => goToPage(currentPage - 1);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevPage();
            } else if (e.key === 'Escape') {
                router.push('/stories');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, storybook]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 animate-pulse flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-4xl">auto_stories</span>
                    </div>
                    <p className="text-xl font-serif text-amber-900">Opening your storybook...</p>
                </div>
            </div>
        );
    }

    if (error || !storybook) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-amber-400 mb-4">menu_book</span>
                    <h1 className="text-3xl font-serif font-bold text-amber-900 mb-4">Storybook Not Found</h1>
                    <p className="text-amber-700 mb-8">{error || 'This storybook could not be loaded.'}</p>
                    <Link href="/stories" className="inline-flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-full font-bold hover:bg-amber-600 transition-all">
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to Stories
                    </Link>
                </div>
            </div>
        );
    }

    const currentScene = storybook.scenes?.[currentPage];
    const progress = storybook.scenes?.length > 0 ? ((currentPage + 1) / storybook.scenes.length) * 100 : 0;

    // If no scenes available, storybook is still being prepared
    if (!currentScene || storybook.scenes.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-r from-amber-200 to-orange-200 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-600 text-5xl">auto_stories</span>
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-amber-900 mb-4">Your Storybook is Being Prepared</h1>
                    <p className="text-amber-700 mb-4 text-lg leading-relaxed">
                        Our storytelling elves are crafting beautiful illustrations for your story. This usually takes a few minutes.
                    </p>
                    <p className="text-amber-600 mb-8 text-sm">
                        💡 <strong>Tip:</strong> Come back in 5 minutes to see your completed storybook!
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link href={`/stories/${storybookId}`} className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-full font-bold hover:bg-amber-600 transition-all">
                            <span className="material-symbols-outlined">menu_book</span>
                            Read the Story Instead
                        </Link>
                        <Link href="/stories" className="inline-flex items-center justify-center gap-2 text-amber-600 hover:text-amber-800 transition-colors">
                            <span className="material-symbols-outlined">arrow_back</span>
                            Back to Stories
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Immersive Mode
    if (isImmersive) {
        return (
            <ImmersiveViewer
                scenes={storybook.scenes}
                title={storybook.title}
                startPage={currentPage}
                onExit={() => setIsImmersive(false)}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col">
            {/* Header */}
            <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-amber-200/50 flex items-center px-6 z-50">
                <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
                    <Link href="/stories" className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="font-bold hidden sm:inline">Back</span>
                    </Link>

                    <h1 className="text-lg font-serif font-bold text-amber-900 truncate max-w-[200px] sm:max-w-none">
                        {storybook.title}
                    </h1>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsImmersive(true)}
                            className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
                            title="Immersive Mode"
                        >
                            <span className="material-symbols-outlined">fullscreen</span>
                            <span className="font-bold hidden sm:inline">Immersive</span>
                        </button>
                        <button
                            onClick={() => {
                                window.open(`/api/storybooks/export?chapterId=${storybookId}&type=storybook`, '_blank');
                            }}
                            className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
                            title="Export as PDF"
                        >
                            <span className="material-symbols-outlined">download</span>
                            <span className="font-bold hidden sm:inline">PDF</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="h-1 bg-amber-200/50">
                <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Main Content - Flipbook */}
            <main className="flex-1 flex items-center justify-center p-6 relative">
                {/* Navigation Arrows */}
                <button
                    onClick={prevPage}
                    disabled={currentPage === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-amber-700 hover:bg-white hover:text-amber-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-2xl">chevron_left</span>
                </button>

                <button
                    onClick={nextPage}
                    disabled={currentPage >= storybook.scenes.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-amber-700 hover:bg-white hover:text-amber-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-2xl">chevron_right</span>
                </button>

                {/* Book Page */}
                <div
                    className={`max-w-4xl w-full aspect-[4/3] bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
                        }`}
                    onClick={() => nextPage()}
                >
                    <div className="h-full flex flex-col md:flex-row">
                        {/* Image Side */}
                        <div className="h-1/2 md:h-full md:w-1/2 bg-gradient-to-br from-amber-100 to-orange-100 relative overflow-hidden">
                            {currentScene.generatedImageUrl || currentScene.imageUrl ? (
                                <img
                                    src={currentScene.generatedImageUrl || currentScene.imageUrl}
                                    alt={`Page ${currentPage + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center text-amber-400">
                                        <span className="material-symbols-outlined text-6xl mb-2">image</span>
                                        <p className="text-sm font-medium">Illustration</p>
                                    </div>
                                </div>
                            )}

                            {/* Page number badge */}
                            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold text-amber-700">
                                Page {currentPage + 1}
                            </div>
                        </div>

                        {/* Text Side */}
                        <div className="h-1/2 md:h-full md:w-1/2 p-8 flex flex-col justify-between bg-gradient-to-br from-amber-50/50 to-white">
                            <div className="prose prose-amber max-w-none flex-1 flex items-center">
                                <p className="text-lg md:text-xl leading-relaxed text-amber-900 font-serif">
                                    {currentScene.text}
                                </p>
                            </div>

                            {/* Audio Player */}
                            <div
                                className="mt-4 pt-4 border-t border-amber-200/50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <AudioPlayer
                                    text={currentScene.text}
                                    key={currentPage} // Reset player when page changes
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Page Thumbnails */}
            <footer className="h-24 bg-white/80 backdrop-blur-xl border-t border-amber-200/50 px-6 py-3">
                <div className="max-w-4xl mx-auto h-full flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {storybook.scenes.map((scene, index) => (
                        <button
                            key={index}
                            onClick={() => goToPage(index)}
                            className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${index === currentPage
                                ? 'border-amber-500 ring-2 ring-amber-300 scale-110'
                                : 'border-amber-200 hover:border-amber-400'
                                }`}
                        >
                            {scene.generatedImageUrl || scene.imageUrl ? (
                                <img
                                    src={scene.generatedImageUrl || scene.imageUrl}
                                    alt={`Page ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                    <span className="text-xs font-bold text-amber-400">{index + 1}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </footer>
        </div>
    );
}

export default function StorybookReaderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 animate-pulse"></div>
            </div>
        }>
            <StorybookReaderContent />
        </Suspense>
    );
}
