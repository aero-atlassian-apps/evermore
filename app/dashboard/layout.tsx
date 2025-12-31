import React from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // Enforce dark theme for the senior immersive experience
        <div className="dark min-h-screen bg-background text-foreground">
            <AppShell userType="senior" showNav={true}>
                {children}
            </AppShell>
        </div>
    );
}
