'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '@/components/layout/AppShell';

// ==========================================================
// Types
// ==========================================================

interface Chapter {
    id: string;
    title: string;
    content?: string;
    createdAt: string;
    coverImageUrl?: string;
    bannerImageUrl?: string;
}

interface UserProfile {
    userId: string;
    role: 'senior' | 'family';
    displayName?: string;
    email?: string;
    photoUrl?: string;
    preferences?: {
        aboutMe?: string;
        topicsLove?: string[];
        birthYear?: number;
        gender?: string;
        location?: string;
        formerOccupation?: string;
        spouseName?: string;
        childrenCount?: number;
        grandchildrenCount?: number;
        favoriteDecade?: string;
    };
}

// ==========================================================
// Constants
// ==========================================================

const TARGET_CHAPTERS = 12;

const FALLBACK_IMAGES = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB1uP1kSbs-YHxcRRKPQopZgwbhcqd-OfV8P0JrEilZJ6d_MmtpwteqqCFrS09Q42HGgucZEzlRqrDw6CAs74McFJHqJkHdzYog-YbhFkTO1qHSgT7jU1aPst3JFdZMLpK0uhsO-fpGuP6dQlhXbWnneamYLEh5bj5J103mTH68DHis7_ptRygyMo6Ba4dBTpQ1I-JTrIhbL6VJ6omN1qv0nDoO2BsRHuJoeymP9P6guBTPvFRJRds9KJTeehLCXGmQfB7YszQpNBo",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAvAvQ9RC6JGyrS_gKf5mBpeubVvJTaP6dIKRZZm2hTVl7nJDrSJn0ojobwYp5svDgODckSByJRv77gG-7Z6g8QCcyAXnjuZUoF4NhkfnIlZdPJaQXcn9Wksp1-bzUBlx33mfu4vMXzcWpEcv2eT4MFjDgJY95cc0hTz6dPlxTZRzyzZ51D-yIKN9YkCyuCmXW80ZU7qd6FWMsT4RCyio3w8Gk9q99dahFMggN0AEbFTXPc-JzjKLq1iapARDauoKc_VGSCdu3nsy0",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDmaBwnfZ0jlqigJaix5kYuz0Rq0JHiiTFWAmZz4VPJF6Ly17lEUbdA0f6lzKqpivxd9bk0hxEHldS4uLelKsew9eey3VqugEZGhIttfhgQX4YXqIRTg1o8d0pPtsr3VOn81miKv41Dyimh4u8jWF8VYlNLH5F_f_brWOxnn_3kMfqT8tm2lGSw91Yrgzqzi2mTudG7RRV5KjXpEB6YYRtiqh9MUis0D6t_PWL63vPdYl-a3tMDYd3svcfefhAEbQjpkwUJO5ov7TA",
];

// ==========================================================
// Component
// ==========================================================

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [recentChapters, setRecentChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchProfileAndChapters() {
            try {
                // Fetch profile
                const profileRes = await fetch('/api/users/profile');
                if (!profileRes.ok) throw new Error('Failed to fetch profile');
                const profileData = await profileRes.json();
                setProfile(profileData);

                // Fetch chapters
                const chaptersRes = await fetch(`/api/users/${profileData.userId}/chapters`, {
                    headers: { 'x-user-id': profileData.userId }
                });
                if (chaptersRes.ok) {
                    const chaptersData = await chaptersRes.json();
                    setRecentChapters(chaptersData.slice(0, 3));
                }
            } catch (err: any) {
                console.error('Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchProfileAndChapters();
    }, []);

    if (loading) {
        return (
            <AppShell showNav={true} userType="senior">
                <div className="min-h-screen bg-background-cream flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
                </div>
            </AppShell>
        );
    }

    if (error || !profile) {
        return (
            <AppShell showNav={true} userType="senior">
                <div className="min-h-screen bg-background-cream flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
                        <span className="material-symbols-outlined text-4xl">error</span>
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-text-primary mb-2">Something went wrong</h1>
                    <p className="text-text-secondary max-w-md">{error || 'Could not load your profile.'}</p>
                    <button onClick={() => window.location.reload()} className="mt-8 px-8 py-3 bg-terracotta text-white rounded-full font-bold shadow-lg">Retry</button>
                </div>
            </AppShell>
        );
    }

    const progress = Math.min(Math.round((recentChapters.length / TARGET_CHAPTERS) * 100), 100);
    const avatarUrl = profile?.role === 'senior'
        ? (profile.photoUrl || '/images/avatar_senior.png')
        : (profile.photoUrl || '/images/avatar_family.png');

    return (
        <AppShell userType="senior" showNav={true}>
            <main className="min-h-screen bg-background-cream pb-24">
                {/* Hero Section */}
                <div className="relative h-[400px] w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-peach-warm/20 via-background-cream to-white"></div>
                    <div className="absolute inset-0 opacity-40 bg-[url('/textures/paper-grain.png')]"></div>
                    <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-peach-main/10 rounded-full blur-[120px]"></div>

                    <div className="container mx-auto px-6 h-full flex flex-col items-center justify-center relative z-10 pt-10">
                        <div className="relative group mb-8">
                            <div className="w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-white shadow-2xl relative transition-transform duration-500 group-hover:scale-105">
                                <Image
                                    src={avatarUrl}
                                    alt={profile.displayName || 'Profile Avatar'}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-terracotta text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-4 border-white">
                                <span className="material-symbols-outlined text-2xl">verified</span>
                            </div>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-serif font-black text-text-primary mb-4 text-center">
                            {profile.displayName || 'Family Storyteller'}
                        </h1>
                        <p className="text-lg text-text-secondary font-medium tracking-widest uppercase opacity-60">
                            {profile.role === 'senior' ? 'Master Storyteller' : 'Family Historian'}
                        </p>
                    </div>
                </div>

                <div className="container mx-auto px-6 -mt-10 relative z-20">
                    <div className="max-w-6xl mx-auto space-y-16">

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-10 border border-white shadow-xl shadow-peach-warm/10 flex flex-col items-center text-center group hover:bg-white transition-all">
                                <div className="w-14 h-14 bg-terracotta/10 rounded-2xl flex items-center justify-center text-terracotta mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-3xl">auto_stories</span>
                                </div>
                                <p className="text-4xl font-serif font-bold text-text-primary mb-2">{recentChapters.length}</p>
                                <p className="text-sm font-bold text-text-muted uppercase tracking-widest opacity-60">Chapters Written</p>
                            </div>

                            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-10 border border-white shadow-xl shadow-peach-warm/10 flex flex-col items-center text-center group hover:bg-white transition-all">
                                <div className="w-14 h-14 bg-peach-main/20 rounded-2xl flex items-center justify-center text-terracotta mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-3xl">favorite</span>
                                </div>
                                <p className="text-4xl font-serif font-bold text-text-primary mb-2">
                                    {profile.preferences?.childrenCount || 0}
                                </p>
                                <p className="text-sm font-bold text-text-muted uppercase tracking-widest opacity-60">Legacy Connections</p>
                            </div>

                            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-10 border border-white shadow-xl shadow-peach-warm/10 flex flex-col items-center text-center group hover:bg-white transition-all">
                                <div className="w-full mb-6">
                                    <div className="flex justify-between items-end mb-4 px-2">
                                        <p className="text-sm font-black text-terracotta uppercase tracking-tighter">{progress}% Complete</p>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Book Progress</p>
                                    </div>
                                    <div className="h-3 bg-peach-main/10 rounded-full overflow-hidden p-0.5">
                                        <div
                                            className="h-full bg-gradient-to-r from-peach-warm to-terracotta rounded-full transition-all duration-1000"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-text-secondary opacity-70">
                                    Only {TARGET_CHAPTERS - recentChapters.length} more memories to finish your first volume.
                                </p>
                            </div>
                        </div>

                        {/* Recent Shared Memories */}
                        <section>
                            <div className="flex justify-between items-end mb-10 px-4">
                                <div>
                                    <h2 className="text-3xl md:text-5xl font-serif font-black text-text-primary mb-2">Recent Shared Memories</h2>
                                    <p className="text-text-secondary font-medium opacity-60">The latest stories from your life's journey.</p>
                                </div>
                                <Link href="/stories" className="text-xs font-black text-terracotta uppercase tracking-[0.2em] border-b-2 border-terracotta/20 pb-1 hover:border-terracotta transition-all mb-2">
                                    View All Stories
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {recentChapters.length > 0 ? (
                                    recentChapters.map((chapter, i) => (
                                        <Link href={`/stories/${chapter.id}`} key={chapter.id} className="group h-full">
                                            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-peach-warm/5 border border-peach-main/5 h-full flex flex-col hover:-translate-y-3 transition-all duration-500">
                                                <div className="aspect-[16/10] overflow-hidden relative">
                                                    <Image
                                                        src={chapter.coverImageUrl || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                                                        alt={chapter.title}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                </div>
                                                <div className="p-8 flex-1 flex flex-col">
                                                    <p className="text-[10px] font-black text-terracotta uppercase tracking-widest mb-3">
                                                        {new Date(chapter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <h3 className="text-xl font-serif font-bold text-text-primary mb-4 line-clamp-2 group-hover:text-terracotta transition-colors">
                                                        {chapter.title || 'Untitled Memory'}
                                                    </h3>
                                                    <p className="text-sm text-text-muted leading-relaxed line-clamp-3 flex-1 italic opacity-80">
                                                        "{chapter.content?.substring(0, 120)}..."
                                                    </p>
                                                    <div className="mt-8 pt-6 border-t border-peach-main/10 flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60">By {profile.displayName || 'You'}</span>
                                                        <span className="text-[10px] font-black text-terracotta uppercase tracking-widest flex items-center gap-1">
                                                            Read <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    [1, 2, 3].map(i => (
                                        <div key={i} className="bg-white/50 rounded-[2.5rem] p-10 border-2 border-dashed border-peach-main/10 flex flex-col items-center justify-center gap-6 opacity-60 grayscale">
                                            <div className="w-20 h-20 bg-peach-main/10 rounded-3xl flex items-center justify-center text-terracotta">
                                                <span className="material-symbols-outlined text-4xl">history_edu</span>
                                            </div>
                                            <p className="text-sm font-bold text-text-secondary text-center">Empty space for a<br />new memory</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* About Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Personal Narrative */}
                            <div className="lg:col-span-8 bg-white/60 backdrop-blur-md rounded-[3rem] p-12 md:p-16 border border-white shadow-2xl shadow-peach-warm/10 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-peach-warm via-terracotta to-peach-warm"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-6 mb-10">
                                        <div className="w-16 h-16 bg-terracotta text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-terracotta/20">
                                            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-serif font-black text-text-primary">Personal Narrative</h2>
                                    </div>
                                    <div className="space-y-8 font-serif text-xl md:text-2xl text-text-secondary leading-relaxed">
                                        <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-terracotta first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                                            {profile.preferences?.aboutMe || (profile.role === 'senior'
                                                ? 'Life is a collection of moments, some small and some that change everything. I\'m here to share those stories with the ones I love.'
                                                : 'A devoted family member helping to preserve our shared history for future generations.')}
                                        </p>
                                    </div>
                                    <div className="mt-12 flex flex-wrap gap-3">
                                        {(profile.preferences?.topicsLove || ['Family', 'Life Lessons', 'Heritage']).map(topic => (
                                            <span key={topic} className="px-6 py-2 bg-peach-main/10 rounded-full text-xs font-black text-terracotta uppercase tracking-widest">
                                                {topic}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] bg-peach-main/5 rounded-full blur-[100px]"></div>
                            </div>

                            {/* Sidebar Details */}
                            <div className="lg:col-span-4 space-y-8">
                                <div className="bg-white rounded-[2.5rem] p-10 border border-peach-main/10 shadow-xl shadow-peach-warm/10">
                                    <h3 className="text-xl font-serif font-bold text-text-primary mb-8 border-b border-peach-main/10 pb-4">Personal Details</h3>
                                    <div className="space-y-8">
                                        {[
                                            { label: 'Former Occupation', value: profile.preferences?.formerOccupation, icon: 'work' },
                                            { label: 'Location', value: profile.preferences?.location, icon: 'location_on' },
                                            { label: 'Favorite Decade', value: profile.preferences?.favoriteDecade, icon: 'event' },
                                            { label: 'Legacy Count', value: `${profile.preferences?.grandchildrenCount || 0} Grandchildren`, icon: 'groups' }
                                        ].map((detail, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                <div className="mt-1 text-terracotta flex-shrink-0">
                                                    <span className="material-symbols-outlined text-xl">{detail.icon}</span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 opacity-60 font-sans">{detail.label}</p>
                                                    <p className="text-base font-bold text-text-secondary font-sans leading-tight">{detail.value || 'Shared with family'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-10">
                                        <Link
                                            href="/profile/edit"
                                            className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-terracotta/20 hover:scale-[1.02] transition-all"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                            Update Profile
                                        </Link>
                                    </div>
                                </div>

                                <div className="bg-peach-main/10 rounded-[2.5rem] p-10 border border-peach-main/20">
                                    <h4 className="text-sm font-black text-terracotta uppercase tracking-[0.2em] mb-4">Account Type</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-terracotta shadow-sm">
                                            <span className="material-symbols-outlined">stars</span>
                                        </div>
                                        <p className="font-serif font-bold text-text-primary">Evermore Legacy Plan</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-peach-main/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
            </main>
        </AppShell>
    );
}
