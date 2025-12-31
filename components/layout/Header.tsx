'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface UserProfile {
    userId: string;
    role: 'senior' | 'family';
    displayName: string;
}

interface NavLink {
    name: string;
    href: string;
    icon: string;
}

// Menu items by persona
const SENIOR_NAV_LINKS: NavLink[] = [
    { name: 'My Stories', href: '/stories', icon: 'menu_book' },
    { name: 'Conversation', href: '/conversation', icon: 'mic' },
    { name: 'Profile', href: '/profile', icon: 'person' },
    { name: 'Settings', href: '/settings', icon: 'settings' },
];

const FAMILY_NAV_LINKS: NavLink[] = [
    { name: 'Family Portal', href: '/family', icon: 'home' },
    { name: 'Profile', href: '/profile', icon: 'person' },
    { name: 'Settings', href: '/settings', icon: 'settings' },
];

const LOGGED_OUT_NAV_LINKS: NavLink[] = [
    { name: 'Login', href: '/login', icon: 'login' },
    { name: 'Get Started', href: '/onboarding', icon: 'arrow_forward' },
];

export function Header({ userProfile }: { userProfile?: UserProfile | null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [profile, setProfile] = useState<UserProfile | null>(userProfile || null);
    const [loading, setLoading] = useState(!userProfile);
    const [isAuthenticated, setIsAuthenticated] = useState(!!userProfile);

    // Update local state if prop changes
    useEffect(() => {
        if (userProfile) {
            setProfile(userProfile);
            setIsAuthenticated(true);
            setLoading(false);
        }
    }, [userProfile]);

    useEffect(() => {
        // Only fetch if no profile provided via props
        if (userProfile !== undefined) return;

        async function fetchProfile() {
            try {
                const res = await fetch('/api/users/profile');
                if (res.ok) {
                    const data = await res.json();
                    setProfile({
                        userId: data.userId || data.id,
                        role: data.role || 'senior',
                        displayName: data.displayName || data.name || 'User',
                    });
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                    setProfile(null);
                }
            } catch (err) {
                console.error('Failed to fetch profile for header:', err);
                setIsAuthenticated(false);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, []);

    const handleLogout = async () => {
        try {
            // Call server-side logout API to properly clear httpOnly cookie
            await fetch('/api/auth/logout', { method: 'POST' });

            // Also clear any client-side cookies as backup
            document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

            setProfile(null);
            setIsAuthenticated(false);
            router.push('/'); // Redirect to landing page
            router.refresh(); // Force refresh to clear any cached auth state
        } catch (err) {
            console.error('Logout error:', err);
            // Even if API fails, still clear client state and redirect
            setProfile(null);
            setIsAuthenticated(false);
            router.push('/');
        }
    };

    // Determine which nav links to show based on auth state and role
    const getNavLinks = (): NavLink[] => {
        if (!isAuthenticated || !profile) {
            return LOGGED_OUT_NAV_LINKS;
        }
        return profile.role === 'family' ? FAMILY_NAV_LINKS : SENIOR_NAV_LINKS;
    };

    const navLinks = getNavLinks();
    const isSenior = profile?.role === 'senior';
    const isFamily = profile?.role === 'family';

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#FCF8F3]/60 backdrop-blur-xl h-20 border-b border-peach-main/10 transition-all">
            <div className="container mx-auto px-6 h-full">
                <div className="flex justify-between items-center h-full">

                    {/* Brand Section */}
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
                            <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm transform group-hover:rotate-6 transition-transform">
                                <Image src="/evermore-icon-white.svg" alt="Evermore Logo" width={24} height={24} className="object-contain" />
                            </div>
                            <div className="flex flex-col -gap-1">
                                <span className="text-2xl font-serif font-extrabold text-terracotta tracking-tight">Evermore</span>
                                {/* Persona Badge */}
                                {isAuthenticated && (
                                    <span className={`text-[10px] font-bold uppercase tracking-tighter -mt-1 ${isFamily ? 'text-blue-500' : 'text-terracotta'
                                        } opacity-60`}>
                                        {isFamily ? 'Family Portal' : 'Storyteller'}
                                    </span>
                                )}
                            </div>
                        </Link>

                        {/* Navigation Links */}
                        <nav className="hidden lg:flex items-center gap-2">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                const isGetStarted = link.name === 'Get Started';

                                return (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isGetStarted
                                            ? 'bg-terracotta text-white hover:bg-sienna shadow-sm'
                                            : isActive
                                                ? 'bg-peach-main text-text-primary shadow-sm ring-1 ring-peach-main/20'
                                                : 'text-text-secondary hover:bg-peach-main/20'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined text-[20px] ${isActive ? 'filled' : ''}`}>{link.icon}</span>
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right Side: Profile & Mobile Menu */}
                    <div className="flex items-center gap-4">

                        {/* Desktop Profile Display */}
                        {!loading && isAuthenticated && profile && (
                            <div className="hidden lg:flex items-center gap-4">
                                <Link href="/profile" className="flex items-center gap-3 bg-white/40 border border-peach-main/20 pl-2 pr-4 py-1.5 rounded-full group hover:bg-white/60 transition-all shadow-sm">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-peach-main/20 shadow-inner">
                                        <Image
                                            src={profile.role === 'senior' ? '/images/avatar_senior.png' : '/images/avatar_family.png'}
                                            alt={profile.displayName}
                                            width={32}
                                            height={32}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-extrabold text-text-primary group-hover:text-terracotta transition-colors">
                                            {profile.displayName}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isFamily ? 'text-blue-400' : 'text-terracotta/70'
                                            }`}>
                                            {isFamily ? 'Family' : 'Senior'}
                                        </span>
                                    </div>
                                </Link>

                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className="bg-white/50 w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-red-500 border border-peach-main/10 transition-all active:scale-90"
                                    title="Log Out"
                                >
                                    <span className="material-symbols-outlined text-xl">logout</span>
                                </button>
                            </div>
                        )}

                        {/* Login Button (Logged Out) */}
                        {!loading && !isAuthenticated && (
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/login"
                                    className="px-4 py-2 rounded-full text-sm font-bold text-text-secondary hover:bg-peach-main/20"
                                >
                                    Login
                                </Link>
                            </div>
                        )}

                        {/* Mobile Menu (Authenticated) */}
                        {!loading && isAuthenticated && (
                            <div className="lg:hidden ml-2">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="ghost" size="icon" className="w-12 h-12 text-terracotta hover:bg-peach-main/20 rounded-full">
                                            <span className="material-symbols-outlined text-3xl">menu</span>
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="right" className="bg-[#FCF8F3] border-l border-peach-main/20 w-[85%] sm:w-[400px]">
                                        <SheetHeader className="text-left mb-8 pt-4">
                                            <SheetTitle className="font-serif font-extrabold text-2xl text-terracotta">Menu</SheetTitle>
                                        </SheetHeader>

                                        <nav className="flex flex-col gap-3">
                                            {navLinks.map((link) => {
                                                const isActive = pathname === link.href;
                                                return (
                                                    <SheetClose asChild key={link.href}>
                                                        <Link
                                                            href={link.href}
                                                            className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-lg font-bold transition-all ${isActive
                                                                ? 'bg-peach-main text-text-primary shadow-sm'
                                                                : 'text-text-secondary hover:bg-peach-main/10'
                                                                }`}
                                                        >
                                                            <span className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}>{link.icon}</span>
                                                            {link.name}
                                                        </Link>
                                                    </SheetClose>
                                                );
                                            })}

                                            <div className="h-px bg-peach-main/20 my-4" />

                                            <SheetClose asChild>
                                                <button
                                                    onClick={handleLogout}
                                                    className="flex items-center gap-4 px-4 py-3 rounded-2xl text-lg font-bold text-red-500 hover:bg-red-50 transition-all text-left w-full"
                                                >
                                                    <span className="material-symbols-outlined text-2xl">logout</span>
                                                    Log Out
                                                </button>
                                            </SheetClose>
                                        </nav>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
