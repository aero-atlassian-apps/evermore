'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Redirect if already authenticated
    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/users/profile');
                if (res.ok) {
                    const profile = await res.json();
                    router.replace(profile.role === 'family' ? '/family' : '/stories');
                }
            } catch (e) {
                // Not authenticated
            }
        };
        checkAuth();
    }, [router]);

    const handleLogin = async (userId?: string, role?: string, email?: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role, email }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Login failed');
            }

            const data = await res.json();

            // Redirect based on role (returned or sent)
            const finalRole = data.role || role;
            if (finalRole === 'senior') {
                router.push('/stories');
            } else {
                router.push('/family');
            }

        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Since we don't have password logic yet, passing email acts as "Login with this email"
        // We pass a placeholder userId/role that might be overridden by the backend lookup
        handleLogin(undefined, undefined, email);
    };

    return (
        <div className="min-h-screen bg-[#FCF8F3] flex flex-col font-sans text-text-primary overflow-x-hidden">

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl h-20 flex items-center border-b border-peach-main/10 shadow-sm transition-all">
                <div className="container mx-auto px-6 h-full flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 group transform active:scale-95 transition-transform">
                        <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm">
                            <Image src="/evermore-icon-white.svg" alt="Evermore Logo" width={24} height={24} className="object-contain" />
                        </div>
                        <span className="text-2xl font-serif font-extrabold text-terracotta tracking-tight">Evermore</span>
                    </Link>
                    <nav className="flex items-center gap-8">
                        <Link href="/" className="text-sm font-bold text-text-secondary hover:text-terracotta transition-colors">Home</Link>
                        <Link href="/onboarding" className="hidden sm:block text-sm font-bold text-text-secondary hover:text-terracotta transition-colors">Join</Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow pt-48 pb-32 flex flex-col items-center justify-center px-6">

                <div className="text-center mb-16 animate-fade-in max-w-2xl px-4">
                    <h1 className="text-5xl md:text-7xl font-serif font-extrabold text-text-primary mb-6 leading-tight">
                        Welcome back to <span className="text-terracotta italic">Evermore</span>
                    </h1>
                    <p className="text-xl text-text-secondary font-medium leading-relaxed opacity-70">
                        Your family's stories are waiting for you. Choose your path to continue your legacy journey.
                    </p>
                </div>

                {/* Login Card */}
                <div className="w-full max-w-4xl animate-fade-in-up">
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-peach-warm/20 border border-peach-main/10 overflow-hidden relative">

                        {/* Decorative Top Bar */}
                        <div className="h-2 bg-gradient-to-r from-peach-warm via-terracotta to-peach-warm"></div>

                        <div className="p-10 md:p-16">

                            {error && (
                                <div className="mb-12 p-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl text-center text-sm font-bold animate-shake">
                                    {error}
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-10 mb-16">

                                {/* Senior Login */}
                                <button
                                    onClick={() => handleLogin('senior-1', 'senior')}
                                    disabled={loading}
                                    className="group flex flex-col items-center p-10 rounded-[2.5rem] bg-peach-main/5 border-2 border-transparent hover:border-terracotta hover:bg-white hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2"
                                >
                                    <div className="w-28 h-28 mb-8 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white relative transition-transform group-hover:scale-110">
                                        <Image
                                            src="/images/avatar_senior.png"
                                            alt="Senior"
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <span className="text-2xl font-serif font-extrabold text-text-primary group-hover:text-terracotta mb-2 transition-colors">The Storyteller</span>
                                    <p className="text-sm text-text-muted font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-60 transition-opacity">Arthur</p>
                                </button>

                                {/* Family Login */}
                                <button
                                    onClick={() => handleLogin('family-1', 'family')}
                                    disabled={loading}
                                    className="group flex flex-col items-center p-10 rounded-[2.5rem] bg-peach-main/5 border-2 border-transparent hover:border-terracotta hover:bg-white hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2"
                                >
                                    <div className="w-28 h-28 mb-8 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white relative transition-transform group-hover:scale-110">
                                        <Image
                                            src="/images/avatar_family.png"
                                            alt="Family"
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <span className="text-2xl font-serif font-extrabold text-text-primary group-hover:text-terracotta mb-2 transition-colors">Family Member</span>
                                    <p className="text-sm text-text-muted font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-60 transition-opacity">Emma</p>
                                </button>

                            </div>

                            {/* Divider */}
                            <div className="relative flex items-center justify-center mb-12">
                                <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-peach-main/30 to-transparent"></div>
                                <span className="relative bg-white px-8 text-xs font-black text-text-muted uppercase tracking-[0.3em] opacity-50">or login with email</span>
                            </div>

                            {/* Email Login Alternative */}
                            <form onSubmit={handleEmailLogin} className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
                                <div className="flex-1 relative group">
                                    <input
                                        type="email"
                                        placeholder="Enter your email..."
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-peach-main/10 border-2 border-transparent focus:border-terracotta rounded-full px-8 py-5 text-base text-text-primary shadow-inner focus:outline-none transition-all placeholder:text-text-muted/40 font-medium"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !email.trim()}
                                    className="bg-terracotta hover:bg-sienna text-white px-10 py-5 rounded-full font-black shadow-xl shadow-terracotta/20 hover:shadow-terracotta/40 transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest text-sm"
                                >
                                    {loading ? 'Logging in...' : 'Continue'}
                                </button>
                            </form>

                            <div className="mt-16 text-center">
                                <p className="text-text-secondary font-medium">
                                    New to Evermore? <Link href="/onboarding" className="text-terracotta font-extrabold underline underline-offset-8 decoration-2 hover:text-sienna transition-colors ml-1">Start your legacy here</Link>
                                </p>
                            </div>

                        </div>
                    </div>
                </div>

            </main>

            {/* Decorative background elements */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] bg-gradient-to-br from-peach-main/5 down-to-white rounded-full blur-[150px] -z-10 pointer-events-none opacity-50"></div>

        </div>
    );
}

