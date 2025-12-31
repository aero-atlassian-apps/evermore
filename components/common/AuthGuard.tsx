'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthGuardProps {
    children: React.ReactNode;
}

/**
 * AuthGuard component that verifies the user has a valid session.
 * 
 * Uses an API call to check session validity since the session cookie
 * is httpOnly and cannot be read via JavaScript.
 * 
 * The middleware validates the session and returns 200 if valid.
 */
export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                // Call profile endpoint - if authenticated, it returns 200
                // This uses an existing endpoint instead of requiring a new one
                const res = await fetch('/api/users/profile', {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!isMounted) return;

                if (res.ok) {
                    setAuthState('authenticated');
                } else if (res.status === 401) {
                    // Unauthorized - session may have expired or user never logged in
                    setAuthState('unauthenticated');
                    router.push(`/login?reason=unauthorized&redirect=${encodeURIComponent(pathname)}`);
                } else {
                    // Other error
                    setAuthState('unauthenticated');
                    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                if (isMounted) {
                    setAuthState('unauthenticated');
                    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
                }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, [router, pathname]);

    // Loading state while checking
    if (authState === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#261E1C]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-white/70 text-sm">Checking session...</p>
                </div>
            </div>
        );
    }

    // If unauthenticated, return null (redirect is happening)
    if (authState === 'unauthenticated') {
        return null;
    }

    // Render children when authenticated
    return <>{children}</>;
}

