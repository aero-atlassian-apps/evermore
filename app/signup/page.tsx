'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [userType, setUserType] = useState<'senior' | 'family'>('senior');
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const type = searchParams.get('type');
        if (type === 'senior' || type === 'family') {
            setUserType(type);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Create User
            const createRes = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.fullName,
                    email: formData.email,
                    role: userType,
                    // Password would be sent here in real app, but MVP API ignores it for now.
                    // We can assume user is created.
                }),
            });

            if (!createRes.ok) throw new Error('Failed to create account');
            const user = await createRes.json();

            // 2. Login (Auto-login)
            // Since API doesn't store password yet, we use the ID returned
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id /* User ID from creation */, role: userType })
            });

            if (!loginRes.ok) throw new Error('Account created but login failed');

            // 3. Redirect
            if (userType === 'senior') {
                router.push('/stories'); // To be replaced by Dashboard logic if strictly needed, but '/stories' is current dashboard
            } else {
                router.push('/family');
            }

        } catch (err) {
            setError('An error occurred during signup. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FCF8F3] flex flex-col font-sans text-text-primary overflow-x-hidden">

            {/* Header / Progress bar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl h-20 flex items-center border-b border-peach-main/10 shadow-sm transition-all">
                <div className="container mx-auto px-6 h-full flex justify-between items-center">

                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2 group transform active:scale-95 transition-transform">
                        <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-white text-2xl filled">mic</span>
                        </div>
                        <span className="text-2xl font-serif font-extrabold text-terracotta tracking-tight">Evermore</span>
                    </Link>

                    {/* Progress Indicator */}
                    <div className="flex flex-col items-center flex-1 max-w-sm px-4">
                        <p className="text-[10px] font-extrabold text-text-secondary uppercase tracking-[0.15em] mb-2.5">
                            Step <span className="text-terracotta">2 of 3</span>: Create Your Account
                        </p>
                        <div className="w-full h-2.5 bg-peach-main/20 rounded-full relative shadow-inner overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-2/3 bg-gradient-to-r from-peach-warm to-terracotta rounded-full flex items-center justify-end pr-1">
                                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm"></div>
                            </div>
                        </div>
                    </div>

                    {/* Navbar Links */}
                    <nav className="hidden lg:flex items-center gap-8">
                        <Link href="/login" className="px-6 py-2 rounded-full border border-peach-main/30 text-sm font-bold text-text-secondary hover:bg-peach-main/10 transition-all">Login</Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow pt-48 pb-32 flex items-center justify-center px-6">
                <div className="w-full max-w-2xl animate-fade-in-up">
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-peach-warm/20 border border-peach-main/10 overflow-hidden relative">

                        {/* Decorative Top Bar */}
                        <div className="h-2 bg-gradient-to-r from-peach-warm via-terracotta to-peach-warm"></div>

                        <div className="p-10 md:p-14">
                            <div className="text-center mb-12">
                                <h1 className="text-4xl md:text-5xl font-serif font-extrabold text-text-primary mb-4">
                                    Start Your Journey
                                </h1>
                                <p className="text-lg text-text-secondary font-medium opacity-70">
                                    Join Evermore to preserve and share your family's priceless legacy.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-10">

                                {/* Persona Selector (Synced with State) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setUserType('senior')}
                                        className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col items-center gap-3 ${userType === 'senior'
                                            ? 'border-terracotta bg-peach-main/10 shadow-inner'
                                            : 'border-peach-main/10 bg-peach-main/5 hover:border-peach-main/30'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${userType === 'senior' ? 'bg-terracotta text-white' : 'bg-white text-text-muted'}`}>
                                            <span className="material-symbols-outlined text-2xl filled">elderly</span>
                                        </div>
                                        <div className="text-center">
                                            <span className={`block text-xs font-black uppercase tracking-widest ${userType === 'senior' ? 'text-terracotta' : 'text-text-muted'}`}>Storyteller</span>
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setUserType('family')}
                                        className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col items-center gap-3 ${userType === 'family'
                                            ? 'border-terracotta bg-peach-main/10 shadow-inner'
                                            : 'border-peach-main/10 bg-peach-main/5 hover:border-peach-main/30'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${userType === 'family' ? 'bg-terracotta text-white' : 'bg-white text-text-muted'}`}>
                                            <span className="material-symbols-outlined text-2xl filled">diversity_3</span>
                                        </div>
                                        <div className="text-center">
                                            <span className={`block text-xs font-black uppercase tracking-widest ${userType === 'family' ? 'text-terracotta' : 'text-text-muted'}`}>Family Member</span>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="px-5 py-3 bg-red-50 border border-red-100 text-red-500 rounded-xl text-sm font-bold text-center animate-shake">
                                        {error}
                                    </div>
                                )}

                                {/* Form Fields */}
                                <div className="space-y-6">
                                    <div className="relative group">
                                        <label className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-black text-terracotta uppercase tracking-[0.2em] transform transition-all group-focus-within:scale-110">Full Name</label>
                                        <input
                                            type="text"
                                            placeholder="Arthur Pendelton"
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 text-text-primary placeholder-text-muted/40 focus:outline-none focus:border-terracotta bg-white/50 transition-all font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="relative group">
                                        <label className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-black text-terracotta uppercase tracking-[0.2em] transform transition-all group-focus-within:scale-110">Email Address</label>
                                        <input
                                            type="email"
                                            placeholder="your@email.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 text-text-primary placeholder-text-muted/40 focus:outline-none focus:border-terracotta bg-white/50 transition-all font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="relative group">
                                        <label className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-black text-terracotta uppercase tracking-[0.2em] transform transition-all group-focus-within:scale-110">Password</label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-8 py-4 rounded-2xl border-2 border-peach-main/20 text-text-primary placeholder-text-muted/40 focus:outline-none focus:border-terracotta bg-white/50 transition-all font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex flex-col items-center gap-6">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-terracotta hover:bg-sienna text-white font-black text-xl py-5 rounded-full shadow-2xl shadow-terracotta/30 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-wait uppercase tracking-[0.1em]"
                                    >
                                        {loading ? 'Creating Account...' : 'Continue'}
                                    </button>

                                    <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-[0.1em] max-w-sm opacity-60">
                                        By joining, you agree to our <Link href="/terms" className="underline hover:text-terracotta transition-colors">Terms</Link> and <Link href="/privacy" className="underline hover:text-terracotta transition-colors">Privacy Policy</Link>.
                                    </p>
                                </div>

                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background-light text-primary">Loading...</div>}>
            <SignupContent />
        </Suspense>
    );
}
