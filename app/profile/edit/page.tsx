'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';

// Define strict interfaces matching DB/DTO
interface EmergencyContact {
    name: string;
    phoneNumber: string;
    email?: string;
    relationship?: string;
}

interface UserPreferences {
    // Conversation
    topicsLove?: string[];
    topicsAvoid?: string[];
    voiceTone?: string;

    // Biographical
    birthYear?: number;
    gender?: 'male' | 'female' | 'other';
    location?: string;
    formerOccupation?: string;
    aboutMe?: string;

    // Family
    spouseName?: string;
    childrenCount?: number;
    grandchildrenCount?: number;

    // Context
    favoriteDecade?: string;
    significantEvents?: string[];
    emergencyContact?: EmergencyContact;
}

interface UserProfile {
    userId: string;
    role: 'senior' | 'family';
    displayName: string;
    preferences?: UserPreferences;
}

export default function EditProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Form State
    const [formData, setFormData] = useState<UserPreferences>({});

    // Local state for array/object inputs
    const [newTopic, setNewTopic] = useState('');
    const [newAvoidTopic, setNewAvoidTopic] = useState('');
    const [newEvent, setNewEvent] = useState('');

    // Fetch Data on Mount
    useEffect(() => {
        async function fetchProfile() {
            try {
                // Cache-busting fetch
                const res = await fetch(`/api/users/profile?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache' }
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('📝 [PROFILE LOAD] Raw Data:', data);

                    setProfile(data);

                    // Merge DB preferences with safe defaults
                    if (data.preferences) {
                        console.log('📝 [PROFILE LOAD] Setting Preferences:', data.preferences);
                        setFormData(data.preferences);
                    }
                }
            } catch (err) {
                console.error('❌ Error fetching profile:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, []);

    // Handlers
    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        setSaveStatus('idle');

        try {
            console.log('💾 [PROFILE SAVE] Sending:', formData);
            const res = await fetch('/api/users/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: profile.role,
                    updates: formData
                }),
            });

            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => router.push(profile.role === 'family' ? '/family' : '/profile'), 1500);
            } else {
                throw new Error('Save failed');
            }
        } catch (err) {
            console.error('❌ Save error:', err);
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    // Topic Helpers
    const toggleTopic = (list: 'topicsLove' | 'topicsAvoid', topic: string, add: boolean) => {
        setFormData(prev => {
            const current = prev[list] || [];
            if (add && !current.includes(topic)) return { ...prev, [list]: [...current, topic] };
            if (!add) return { ...prev, [list]: current.filter(t => t !== topic) };
            return prev;
        });
    };

    // Event Helper
    const toggleEvent = (event: string, add: boolean) => {
        setFormData(prev => {
            const current = prev.significantEvents || [];
            if (add && !current.includes(event)) return { ...prev, significantEvents: [...current, event] };
            if (!add) return { ...prev, significantEvents: current.filter(e => e !== event) };
            return prev;
        });
    };

    if (loading) return (
        <AppShell userType="senior" showNav={true}><div className="p-8 text-center">Loading Profile...</div></AppShell>
    );

    return (
        <AppShell userType={profile?.role || 'senior'} userName={profile?.displayName} showNav={true}>
            <main className="container mx-auto py-10 px-4 max-w-6xl">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-serif font-extrabold text-text-primary">
                        <span className="text-terracotta">Update</span> {profile?.displayName.split(' ')[0]}'s Details <span className="text-3xl">📖</span>
                    </h1>
                </div>

                <div className="grid lg:grid-cols-12 gap-12 items-start">
                    {/* Left Side: Avatar Card */}
                    <div className="lg:col-span-4 flex flex-col items-center">
                        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-peach-warm/20 border border-peach-main/10 flex flex-col items-center w-full sticky top-32">
                            <div className="w-48 h-48 rounded-full border-4 border-peach-main/20 p-1 bg-white relative mb-8 group overflow-hidden">
                                <div className="w-full h-full rounded-full overflow-hidden relative">
                                    <Image
                                        src={profile?.role === 'senior' ? '/images/avatar_senior.png' : '/images/avatar_family.png'}
                                        alt={profile?.displayName || 'User'}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-serif font-bold text-text-primary mb-6">{profile?.displayName}</h3>
                            <button
                                onClick={() => alert("Photo upload coming soon!")}
                                className="px-8 py-3 rounded-full bg-peach-main/10 text-text-primary font-bold hover:bg-peach-main/20 transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-xl">image</span>
                                Change Photo
                            </button>
                        </div>
                    </div>

                    {/* Right Side: Form Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* 1. PERSONAL INFO */}
                        <div className="bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-peach-warm/20 border border-peach-main/10">
                            <div className="space-y-10">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Display Name</label>
                                    <input
                                        disabled
                                        value={profile?.displayName || ''}
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 bg-[#FCF8F3]/30 font-medium text-text-secondary cursor-not-allowed"
                                    />
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Birth Year</label>
                                        <input
                                            type="number"
                                            value={formData.birthYear ?? ''}
                                            onChange={e => setFormData({ ...formData, birthYear: parseInt(e.target.value) || undefined })}
                                            placeholder="e.g., 1945"
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Gender</label>
                                        <select
                                            value={formData.gender || ''}
                                            onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all appearance-none"
                                        >
                                            <option value="">Select...</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Location</label>
                                        <input
                                            value={formData.location || ''}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="City, State/Country"
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Former Occupation</label>
                                        <input
                                            value={formData.formerOccupation || ''}
                                            onChange={e => setFormData({ ...formData, formerOccupation: e.target.value })}
                                            placeholder="e.g., Teacher, Engineer"
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">About Me</label>
                                    <textarea
                                        value={formData.aboutMe || ''}
                                        onChange={e => setFormData({ ...formData, aboutMe: e.target.value })}
                                        rows={4}
                                        placeholder="Share your story..."
                                        className="w-full px-8 py-5 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all resize-none leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. FAMILY INFO */}
                        <div className="bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-peach-warm/20 border border-peach-main/10">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted mb-10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-terracotta/60">family_restroom</span>
                                Family Information
                            </h2>
                            <div className="grid md:grid-cols-3 gap-8">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-2 px-1">Spouse Name</label>
                                    <input
                                        value={formData.spouseName || ''}
                                        onChange={e => setFormData({ ...formData, spouseName: e.target.value })}
                                        placeholder="Optional"
                                        className="w-full px-6 py-3 rounded-xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-2 px-1">Children</label>
                                    <input
                                        type="number"
                                        value={formData.childrenCount ?? ''}
                                        onChange={e => setFormData({ ...formData, childrenCount: parseInt(e.target.value) || 0 })}
                                        className="w-full px-6 py-3 rounded-xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-2 px-1">Grandchildren</label>
                                    <input
                                        type="number"
                                        value={formData.grandchildrenCount ?? ''}
                                        onChange={e => setFormData({ ...formData, grandchildrenCount: parseInt(e.target.value) || 0 })}
                                        className="w-full px-6 py-3 rounded-xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium text-sm transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. MEMORY CONTEXT */}
                        <div className="bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-peach-warm/20 border border-peach-main/10">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted mb-10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-terracotta/60">history_edu</span>
                                Memory Context
                            </h2>
                            <div className="space-y-10">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Favorite Decade</label>
                                    <select
                                        value={formData.favoriteDecade || ''}
                                        onChange={e => setFormData({ ...formData, favoriteDecade: e.target.value })}
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all appearance-none"
                                    >
                                        <option value="">Select your favorite era...</option>
                                        <option value="1940s">1940s</option>
                                        <option value="1950s">1950s</option>
                                        <option value="1960s">1960s</option>
                                        <option value="1970s">1970s</option>
                                        <option value="1980s">1980s</option>
                                        <option value="1990s">1990s</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Significant Life Events</label>
                                    <div className="flex flex-wrap gap-2 mb-6 min-h-[40px]">
                                        {(formData.significantEvents || []).map(event => (
                                            <span key={event} className="px-4 py-2 bg-white rounded-full text-sm font-bold text-brown-main shadow-sm border border-peach-main/10 flex items-center gap-2 group animate-in fade-in zoom-in duration-300">
                                                {event}
                                                <button onClick={() => toggleEvent(event, false)} className="material-symbols-outlined text-sm text-text-muted hover:text-red-500 transition-colors">close</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <input
                                            value={newEvent}
                                            onChange={e => setNewEvent(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (newEvent.trim()) { toggleEvent(newEvent.trim(), true); setNewEvent(''); }
                                                }
                                            }}
                                            placeholder="Add event (e.g., Moved to Boston)..."
                                            className="flex-1 px-8 py-3 rounded-full border-2 border-peach-main/10 focus:border-terracotta outline-none font-medium transition-all"
                                        />
                                        <button
                                            onClick={() => { if (newEvent.trim()) { toggleEvent(newEvent.trim(), true); setNewEvent(''); } }}
                                            className="px-6 py-3 bg-peach-main/10 text-brown-main rounded-full font-bold hover:bg-peach-main/20 transition-all flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">add</span>
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. EMERGENCY CONTACT */}
                        <div className="bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-peach-warm/20 border border-peach-main/10">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted mb-10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-terracotta/60">emergency</span>
                                Emergency Contact
                            </h2>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Name</label>
                                    <input
                                        value={formData.emergencyContact?.name || ''}
                                        onChange={e => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact!, name: e.target.value } })}
                                        placeholder="Contact Name"
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Phone</label>
                                    <input
                                        value={formData.emergencyContact?.phoneNumber || ''}
                                        onChange={e => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact!, phoneNumber: e.target.value } })}
                                        placeholder="Phone Number"
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Relationship</label>
                                    <input
                                        value={formData.emergencyContact?.relationship || ''}
                                        onChange={e => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact!, relationship: e.target.value } })}
                                        placeholder="e.g. Daughter"
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-4 text-left px-1">Email</label>
                                    <input
                                        value={formData.emergencyContact?.email || ''}
                                        onChange={e => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact!, email: e.target.value } })}
                                        placeholder="Email Address"
                                        className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 focus:border-terracotta focus:outline-none bg-[#FCF8F3]/30 font-medium transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. TOPICS */}
                        <div className="bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-peach-warm/20 border border-peach-main/10">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-text-muted mb-10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-terracotta/60">interests</span>
                                Topics & Interests
                            </h2>
                            <div className="grid md:grid-cols-2 gap-12">
                                {/* Love */}
                                <div className="space-y-6">
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-green-700/60 mb-4 px-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">favorite</span>
                                        I Love to Discuss
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                                        {(formData.topicsLove || []).map(topic => (
                                            <span key={topic} className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-100 flex items-center gap-2 group shadow-sm transition-all hover:scale-105">
                                                {topic}
                                                <button onClick={() => toggleTopic('topicsLove', topic, false)} className="material-symbols-outlined text-sm opacity-50 hover:opacity-100 transition-opacity">close</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={newTopic}
                                            onChange={e => setNewTopic(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newTopic.trim()) { toggleTopic('topicsLove', newTopic.trim(), true); setNewTopic(''); } } }}
                                            placeholder="Add topic..."
                                            className="flex-1 px-6 py-2 rounded-full border-2 border-green-50 focus:border-green-400 outline-none text-sm transition-all"
                                        />
                                        <button onClick={() => { if (newTopic.trim()) { toggleTopic('topicsLove', newTopic.trim(), true); setNewTopic(''); } }} className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors">+</button>
                                    </div>
                                </div>
                                {/* Avoid */}
                                <div className="space-y-6">
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-red-700/60 mb-4 px-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">block</span>
                                        I Prefer to Avoid
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                                        {(formData.topicsAvoid || []).map(topic => (
                                            <span key={topic} className="px-4 py-2 bg-red-50 text-red-700 rounded-full text-sm font-bold border border-red-100 flex items-center gap-2 group shadow-sm transition-all hover:scale-105">
                                                {topic}
                                                <button onClick={() => toggleTopic('topicsAvoid', topic, false)} className="material-symbols-outlined text-sm opacity-50 hover:opacity-100 transition-opacity">close</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={newAvoidTopic}
                                            onChange={e => setNewAvoidTopic(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newAvoidTopic.trim()) { toggleTopic('topicsAvoid', newAvoidTopic.trim(), true); setNewAvoidTopic(''); } } }}
                                            placeholder="Add topic..."
                                            className="flex-1 px-6 py-2 rounded-full border-2 border-red-50 focus:border-red-400 outline-none text-sm transition-all"
                                        />
                                        <button onClick={() => { if (newAvoidTopic.trim()) { toggleTopic('topicsAvoid', newAvoidTopic.trim(), true); setNewAvoidTopic(''); } }} className="w-10 h-10 bg-red-100 text-red-700 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-6 pt-10">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-5 rounded-full bg-[#8CAF8C] hover:bg-[#7A9E7A] text-white font-black text-xl shadow-xl shadow-green-900/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Saving...
                                    </span>
                                ) : 'Save Changes'}
                            </button>
                            <Link
                                href="/profile"
                                className="flex-1 py-5 rounded-full bg-peach-main/10 hover:bg-peach-main/20 text-brown-main font-black text-xl text-center transition-all"
                            >
                                Cancel
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </AppShell>
    );
}
