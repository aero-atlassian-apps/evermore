import React from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function FamilyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // Family portal adapts to system or can be forced. 
        // For visual harmony, let's keep it clean/light for readability but using the warm palette.
        <div className="min-h-screen bg-warm-bg-light text-foreground">
            <AppShell userType="family" showNav={true}>
                {children}
            </AppShell>
        </div>
    );
}
