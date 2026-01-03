import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin Dashboard | Evermore',
    description: 'Real-time monitoring and metrics for Evermore',
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-900">
            {children}
        </div>
    );
}
