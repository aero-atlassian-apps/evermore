'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingHero } from '@/components/marketing/MarketingHero';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    // Redirect authenticated users to their dashboard
    useEffect(() => {
        async function checkAuth() {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const res = await fetch('/api/users/profile', { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const profile = await res.json();
                    // User is authenticated, redirect to persona-appropriate dashboard
                    const dashboard = profile.role === 'family' ? '/family' : '/stories';
                    router.replace(dashboard);
                    return;
                }
            } catch (err) {
                // Not authenticated or timeout, show landing page
                console.log("Auth check skipped or failed:", err);
            }
            setChecking(false);
        }
        checkAuth();
    }, [router]);

    // Show loading while checking auth
    if (checking) {
        return (
            <div className="min-h-screen bg-[#FCF8F3] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-terracotta/30 border-t-terracotta rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-[#FCF8F3] font-sans selection:bg-gold/30 flex flex-col">
            <MarketingHeader />

            <main>
                <MarketingHero />
                {/* Additional sections (How it Works, etc.) could be added here in the future */}
            </main>

            <MarketingFooter />
        </div>
    );
}

