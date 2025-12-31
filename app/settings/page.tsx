'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';

interface UserProfile {
    userId: string;
    role: 'senior' | 'family';
    displayName: string;
    preferences?: {
        voiceTone?: string;
        topicsLove?: string[];
        topicsAvoid?: string[];
        timezone?: string;
    };
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activeTone, setActiveTone] = useState('Friendly');
    const [topics, setTopics] = useState<string[]>([]);
    const [newTopic, setNewTopic] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [activeSection, setActiveSection] = useState('preferences');

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/users/profile');
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                    setDisplayName(data.displayName || '');
                    setActiveTone(data.preferences?.voiceTone || 'Friendly');
                    setTopics(data.preferences?.topicsLove || []);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, []);

    const handleAddTopic = () => {
        if (newTopic.trim() && !topics.includes(newTopic.trim())) {
            setTopics([...topics, newTopic.trim()]);
            setNewTopic('');
        }
    };

    const removeTopic = (topicToRemove: string) => {
        setTopics(topics.filter(t => t !== topicToRemove));
    };

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        setSaveStatus('idle');

        try {
            const res = await fetch('/api/users/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: profile.role,
                    updates: {
                        voiceTone: activeTone,
                        topicsLove: topics,
                    }
                }),
            });

            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AppShell userType="senior" showNav={true}>
                <div className="max-w-3xl mx-auto py-8 px-4">
                    <div className="animate-pulse space-y-8">
                        <div className="h-8 bg-border-light rounded w-1/2 mx-auto"></div>
                        <div className="h-12 bg-border-light rounded"></div>
                        <div className="h-12 bg-border-light rounded"></div>
                        <div className="h-12 bg-border-light rounded"></div>
                    </div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell userType={profile?.role} showNav={true}>

            {/* Page Header */}
            <div className="flex items-center justify-between mb-16 animate-fade-in">
                <div className="flex items-center gap-6">
                    <Link href={profile?.role === 'family' ? '/family' : '/stories'} className="w-14 h-14 flex items-center justify-center rounded-full bg-white shadow-lg shadow-peach-warm/5 border border-peach-main/10 text-text-muted hover:text-terracotta transition-all">
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </Link>
                    <h1 className="text-5xl font-serif font-extrabold text-text-primary">
                        Settings
                    </h1>
                </div>
                <p className="hidden md:block text-lg text-text-secondary font-medium italic opacity-70">Personalize your Evermore</p>
            </div>

            <div className="grid md:grid-cols-3 gap-16 animate-fade-in [animation-delay:0.1s]">

                {/* Navigation Sidebar */}
                <div className="md:col-span-1 space-y-3">
                    <button
                        onClick={() => setActiveSection('preferences')}
                        className={`w-full text-left px-8 py-4 rounded-2xl font-bold transition-all ${activeSection === 'preferences' ? 'bg-white shadow-lg shadow-peach-warm/5 text-terracotta border border-peach-main/10' : 'text-text-muted hover:bg-white/50'}`}>
                        Preferences
                    </button>
                    <button
                        onClick={() => setActiveSection('security')}
                        className={`w-full text-left px-8 py-4 rounded-2xl font-bold transition-all ${activeSection === 'security' ? 'bg-white shadow-lg shadow-peach-warm/5 text-terracotta border border-peach-main/10' : 'text-text-muted hover:bg-white/50'}`}>
                        Account Security
                    </button>
                    <button
                        onClick={() => setActiveSection('notifications')}
                        className={`w-full text-left px-8 py-4 rounded-2xl font-bold transition-all ${activeSection === 'notifications' ? 'bg-white shadow-lg shadow-peach-warm/5 text-terracotta border border-peach-main/10' : 'text-text-muted hover:bg-white/50'}`}>
                        Notifications
                    </button>
                    <button
                        onClick={() => setActiveSection('family')}
                        className={`w-full text-left px-8 py-4 rounded-2xl font-bold transition-all ${activeSection === 'family' ? 'bg-white shadow-lg shadow-peach-warm/5 text-terracotta border border-peach-main/10' : 'text-text-muted hover:bg-white/50'}`}>
                        Family Settings
                    </button>
                </div>

                {/* Main Settings Panel */}
                <div className="md:col-span-2 space-y-14">
                    {activeSection !== 'preferences' ? (
                        <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-2xl shadow-peach-warm/5 border border-peach-main/10">
                            <div className="w-20 h-20 bg-peach-main/10 rounded-3xl flex items-center justify-center text-terracotta mx-auto mb-6">
                                <span className="material-symbols-outlined text-4xl">construction</span>
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-text-primary mb-2">Coming Soon</h3>
                            <p className="text-text-secondary opacity-70">This section is currently under construction.</p>
                        </div>
                    ) : (
                        <>

                            {/* Voice Tone Selection */}
                            <section className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-peach-warm/5 border border-peach-main/10">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-peach-main/10 flex items-center justify-center text-terracotta">
                                        <span className="material-symbols-outlined text-2xl">spatial_audio_off</span>
                                    </div>
                                    <h2 className="text-2xl font-serif font-extrabold text-text-primary">Companion Voice Tone</h2>
                                </div>
                                <p className="text-text-secondary mb-10 leading-relaxed opacity-70">Choose how your Evermore companion sounds during conversations.</p>

                                <div className="flex p-2 bg-[#FFF5ED] rounded-full border border-peach-main/10 max-w-md">
                                    {['Warm', 'Friendly', 'Gentle'].map((tone) => (
                                        <button
                                            key={tone}
                                            onClick={() => setActiveTone(tone)}
                                            className={`
                                            flex-1 py-4 rounded-full text-sm font-bold transition-all duration-300
                                            ${activeTone === tone
                                                    ? 'bg-[#D4A373] text-white shadow-xl'
                                                    : 'text-brown-main opacity-70 hover:opacity-100'
                                                }
                                        `}
                                        >
                                            {tone}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Topics Section */}
                            <section className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-peach-warm/5 border border-peach-main/10">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-peach-main/10 flex items-center justify-center text-terracotta">
                                        <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                                    </div>
                                    <h2 className="text-2xl font-serif font-extrabold text-text-primary">Memory Focus</h2>
                                </div>
                                <p className="text-text-secondary mb-10 leading-relaxed opacity-70">Add topics or time periods you'd like your companion to explore with you more often.</p>

                                <div className="flex flex-wrap gap-3 mb-8">
                                    {topics.map((topic) => (
                                        <span key={topic} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-peach-main/10 text-terracotta text-sm font-bold border border-peach-main/10">
                                            {topic}
                                            <button onClick={() => removeTopic(topic)} className="hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    <div className="relative flex-1 min-w-[150px]">
                                        <input
                                            type="text"
                                            value={newTopic}
                                            onChange={(e) => setNewTopic(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                                            placeholder="Add topic..."
                                            className="w-full bg-transparent border-b-2 border-peach-main/20 py-2 text-sm text-text-primary focus:outline-none focus:border-terracotta transition-all placeholder:text-text-muted italic"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Account Section */}
                            <section className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-peach-warm/5 border border-peach-main/10">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-14 h-14 rounded-2xl bg-peach-main/10 flex items-center justify-center text-terracotta">
                                        <span className="material-symbols-outlined text-2xl">account_circle</span>
                                    </div>
                                    <h2 className="text-2xl font-serif font-extrabold text-text-primary">Account Details</h2>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <label className="md:w-40 text-xs font-black text-text-muted uppercase tracking-widest">Display Name</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            readOnly
                                            disabled
                                            className="flex-1 bg-gray-100 border-2 border-gray-200 rounded-xl px-6 py-4 text-sm text-text-muted cursor-not-allowed font-medium opacity-70"
                                            title="Display name updates are disabled for this account type"
                                        />
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <label className="md:w-40 text-xs font-black text-text-muted uppercase tracking-widest">Account Type</label>
                                        <div className="flex-1 bg-peach-main/10 border-2 border-peach-main/10 rounded-xl px-6 py-4 text-sm text-terracotta font-bold">
                                            {profile?.role === 'senior' ? 'Storyteller (Solo)' : 'Family Archivist'}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Save Actions */}
                            <div className="pt-10 border-t border-peach-main/10 flex items-center justify-between">
                                <div className="flex-1">
                                    {saveStatus === 'success' && (
                                        <div className="flex items-center gap-3 text-green-600 text-sm font-bold animate-fade-in">
                                            <span className="material-symbols-outlined text-xl">check_circle</span>
                                            Your changes have been preserved.
                                        </div>
                                    )}
                                    {saveStatus === 'error' && (
                                        <div className="flex items-center gap-3 text-red-500 text-sm font-bold animate-fade-in">
                                            <span className="material-symbols-outlined text-xl">error</span>
                                            Something went wrong. Please try again.
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-[#D4A373] hover:bg-[#C18E5E] text-white px-12 py-4 rounded-full font-bold shadow-xl shadow-peach-warm/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-3"
                                >
                                    {saving ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">save</span>
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>

            </div>

        </AppShell>
    );
}
