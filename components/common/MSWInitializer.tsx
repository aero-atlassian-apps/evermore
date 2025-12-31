'use client';

import { useEffect } from 'react';

/**
 * Client component that initializes MSW for mock API responses.
 * Only activates when NEXT_PUBLIC_USE_MOCKS=true.
 * 
 * Separated from layout.tsx to prevent hydration mismatches
 * since the layout should be a Server Component.
 */
export function MSWInitializer() {
    useEffect(() => {
        const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
        if (useMocks && typeof window !== 'undefined') {
            const startMocking = async () => {
                try {
                    const { worker } = await import('@/lib/mocks/browser');
                    await worker.start({
                        onUnhandledRequest: 'bypass', // Don't warn for unhandled requests
                    });
                    console.log('[MSW] Mock Service Worker started');
                } catch (error) {
                    console.error('[MSW] Failed to start:', error);
                }
            };
            startMocking();
        }
    }, []);

    return null; // This component renders nothing
}
