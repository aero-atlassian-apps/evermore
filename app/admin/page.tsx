'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

interface DashboardData {
    timestamp: string;
    sessions: {
        active: number;
        total24h: number;
        avgDuration: string;
    };
    performance: {
        http: { p50: number; p95: number; p99: number; totalRequests: number };
        llm: { p50: number; p95: number; p99: number; totalCalls: number };
        agent: { avgDuration: number; totalExecutions: number };
        errorRate: string;
    };
    safety: {
        alertsToday: number;
        byType: Record<string, number>;
    };
    costs: {
        today: number;
        last24h: number;
        byModel: Record<string, { tokens: number; cost: number }>;
        byPurpose: Record<string, { tokens: number; cost: number }>;
    };
    rateLimiting: {
        totalChecks: number;
        exceeded: number;
        exceededCount: number;
    };
    tokens: {
        total24h: number;
        avgPerRequest: number;
    };
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCard({
    title,
    value,
    subtitle,
    trend,
    color = 'blue',
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down' | 'stable';
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}) {
    const colorClasses = {
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
        yellow: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    };

    const trendIcons = {
        up: '↑',
        down: '↓',
        stable: '→',
    };

    return (
        <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{value}</span>
                {trend && (
                    <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
                        {trendIcons[trend]}
                    </span>
                )}
            </div>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
    );
}

// ============================================================================
// Safety Alerts Panel
// ============================================================================

function SafetyAlertsPanel({ alerts }: { alerts: DashboardData['safety'] }) {
    const alertTypes = [
        { key: 'wellbeing', label: 'Wellbeing Concerns', color: 'bg-amber-500' },
        { key: 'scam', label: 'Scam Detection', color: 'bg-red-500' },
        { key: 'crisis', label: 'Crisis Escalation', color: 'bg-red-600' },
        { key: 'other', label: 'Other Alerts', color: 'bg-gray-500' },
    ];

    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Safety Alerts Today</h3>
            <div className="text-4xl font-bold text-white mb-4">{alerts.alertsToday}</div>
            <div className="space-y-3">
                {alertTypes.map(({ key, label, color }) => (
                    <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color}`} />
                            <span className="text-gray-300">{label}</span>
                        </div>
                        <span className="text-white font-medium">{alerts.byType[key] || 0}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Cost Tracker Panel
// ============================================================================

function CostTrackerPanel({ costs }: { costs: DashboardData['costs'] }) {
    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Tracking</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p className="text-sm text-gray-400">Last Hour</p>
                    <p className="text-2xl font-bold text-emerald-400">${(costs.today / 100).toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-400">Last 24h</p>
                    <p className="text-2xl font-bold text-white">${(costs.last24h / 100).toFixed(2)}</p>
                </div>
            </div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">By Purpose</h4>
            <div className="space-y-2">
                {Object.entries(costs.byPurpose || {}).slice(0, 5).map(([purpose, data]) => (
                    <div key={purpose} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 capitalize">{purpose.replace(/_/g, ' ')}</span>
                        <span className="text-white">${(data.cost / 100).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Performance Panel
// ============================================================================

function PerformancePanel({ performance }: { performance: DashboardData['performance'] }) {
    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Performance</h3>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">HTTP Requests</span>
                        <span className="text-white">{performance.http.totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                        <span className="text-gray-500">P50: {performance.http.p50}ms</span>
                        <span className="text-gray-500">P95: {performance.http.p95}ms</span>
                        <span className="text-gray-500">P99: {performance.http.p99}ms</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">LLM Calls</span>
                        <span className="text-white">{performance.llm.totalCalls.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                        <span className="text-gray-500">P50: {performance.llm.p50}ms</span>
                        <span className="text-gray-500">P95: {performance.llm.p95}ms</span>
                        <span className="text-gray-500">P99: {performance.llm.p99}ms</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Agent Executions</span>
                        <span className="text-white">{performance.agent.totalExecutions.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Avg: {performance.agent.avgDuration}ms
                    </div>
                </div>

                <div className="pt-2 border-t border-gray-700">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Error Rate</span>
                        <span className={parseFloat(performance.errorRate) > 1 ? 'text-red-400' : 'text-emerald-400'}>
                            {performance.errorRate}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchDashboard = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/dashboard');
            if (!response.ok) {
                if (response.status === 401) {
                    setError('Unauthorized - Admin access required');
                    return;
                }
                throw new Error('Failed to fetch dashboard data');
            }
            const dashboardData = await response.json();
            setData(dashboardData);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchDashboard, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [autoRefresh, fetchDashboard]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                    <p className="text-gray-400 mt-1">
                        Real-time monitoring for Evermore
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-gray-400">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh
                    </label>
                    <button
                        onClick={fetchDashboard}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        Refresh
                    </button>
                    {lastUpdated && (
                        <span className="text-sm text-gray-500">
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                    title="Active Sessions"
                    value={data.sessions.active}
                    subtitle={`${data.sessions.total24h} total today`}
                    color="blue"
                />
                <MetricCard
                    title="API Latency (P95)"
                    value={`${data.performance.http.p95}ms`}
                    subtitle={`${data.performance.http.totalRequests.toLocaleString()} requests`}
                    color={data.performance.http.p95 > 500 ? 'red' : 'green'}
                />
                <MetricCard
                    title="Error Rate"
                    value={`${data.performance.errorRate}%`}
                    subtitle="Last 24 hours"
                    color={parseFloat(data.performance.errorRate) > 1 ? 'red' : 'green'}
                />
                <MetricCard
                    title="LLM Cost (24h)"
                    value={`$${(data.costs.last24h / 100).toFixed(2)}`}
                    subtitle={`${data.tokens.total24h.toLocaleString()} tokens`}
                    color="purple"
                />
            </div>

            {/* Detail Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <PerformancePanel performance={data.performance} />
                <SafetyAlertsPanel alerts={data.safety} />
                <CostTrackerPanel costs={data.costs} />
            </div>

            {/* Token Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Token Usage</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-400">Total (24h)</p>
                            <p className="text-2xl font-bold text-white">{data.tokens.total24h.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Avg per Request</p>
                            <p className="text-2xl font-bold text-white">{data.tokens.avgPerRequest.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Rate Limiting</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-400">Total Checks</p>
                            <p className="text-2xl font-bold text-white">{data.rateLimiting.totalChecks.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Exceeded</p>
                            <p className="text-2xl font-bold text-red-400">{data.rateLimiting.exceededCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
                Evermore Admin Dashboard • Data updates every 10 seconds
            </div>
        </div>
    );
}
