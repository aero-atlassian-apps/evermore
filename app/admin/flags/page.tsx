'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeatureFlag, FlagCreate, RolloutStrategy } from '@/lib/core/application/services/flags/types';

// ============================================================================
// Types
// ============================================================================

interface FlagFormData {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    rolloutType: RolloutStrategy['type'];
    rolloutPercentage: number;
    rolloutUserIds: string;
    environments: string[];
}

// ============================================================================
// Admin Flags Page
// ============================================================================

export default function AdminFlagsPage() {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

    // Form state
    const [formData, setFormData] = useState<FlagFormData>({
        key: '',
        name: '',
        description: '',
        enabled: false,
        rolloutType: 'boolean',
        rolloutPercentage: 100,
        rolloutUserIds: '',
        environments: [],
    });

    // Fetch flags
    const fetchFlags = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/flags');
            if (!response.ok) {
                if (response.status === 401) {
                    setError('Unauthorized - Admin access required');
                    return;
                }
                throw new Error('Failed to fetch flags');
            }
            const data = await response.json();
            setFlags(data.flags || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFlags();
    }, [fetchFlags]);

    // Create flag
    const handleCreate = async () => {
        try {
            const rollout = buildRolloutStrategy();
            const createData: FlagCreate = {
                key: formData.key,
                name: formData.name,
                description: formData.description || undefined,
                enabled: formData.enabled,
                rollout,
                environments: formData.environments.length > 0 ? formData.environments : undefined,
            };

            const response = await fetch('/api/admin/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create flag');
            }

            resetForm();
            setShowCreateForm(false);
            fetchFlags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Update flag
    const handleUpdate = async () => {
        if (!editingFlag) return;

        try {
            const rollout = buildRolloutStrategy();
            const response = await fetch('/api/admin/flags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: editingFlag.key,
                    updates: {
                        name: formData.name,
                        description: formData.description || undefined,
                        enabled: formData.enabled,
                        rollout,
                        environments: formData.environments.length > 0 ? formData.environments : undefined,
                    },
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update flag');
            }

            resetForm();
            setEditingFlag(null);
            fetchFlags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Delete flag
    const handleDelete = async (key: string) => {
        if (!confirm(`Delete flag "${key}"?`)) return;

        try {
            const response = await fetch('/api/admin/flags', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });

            if (!response.ok) throw new Error('Failed to delete');
            fetchFlags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Toggle flag enabled
    const handleToggle = async (flag: FeatureFlag) => {
        try {
            const response = await fetch('/api/admin/flags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: flag.key,
                    updates: { enabled: !flag.enabled },
                }),
            });

            if (!response.ok) throw new Error('Failed to toggle');
            fetchFlags();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Build rollout strategy from form
    const buildRolloutStrategy = (): RolloutStrategy => {
        switch (formData.rolloutType) {
            case 'percentage':
                return { type: 'percentage', value: formData.rolloutPercentage };
            case 'userIds':
                return {
                    type: 'userIds',
                    ids: formData.rolloutUserIds.split(',').map(s => s.trim()).filter(Boolean)
                };
            default:
                return { type: 'boolean' };
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            key: '',
            name: '',
            description: '',
            enabled: false,
            rolloutType: 'boolean',
            rolloutPercentage: 100,
            rolloutUserIds: '',
            environments: [],
        });
    };

    // Edit flag
    const startEdit = (flag: FeatureFlag) => {
        setEditingFlag(flag);
        setFormData({
            key: flag.key,
            name: flag.name,
            description: flag.description || '',
            enabled: flag.enabled,
            rolloutType: flag.rollout.type,
            rolloutPercentage: flag.rollout.type === 'percentage' ? flag.rollout.value : 100,
            rolloutUserIds: flag.rollout.type === 'userIds' ? flag.rollout.ids.join(', ') : '',
            environments: flag.environments || [],
        });
        setShowCreateForm(false);
    };

    // Render
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Feature Flags</h1>
                    <p className="text-gray-400 mt-1">Manage feature rollouts and A/B tests</p>
                </div>
                <button
                    onClick={() => { setShowCreateForm(true); setEditingFlag(null); resetForm(); }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                    + Create Flag
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Create/Edit Form */}
            {(showCreateForm || editingFlag) && (
                <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
                    <h2 className="text-xl font-semibold text-white mb-4">
                        {editingFlag ? `Edit: ${editingFlag.key}` : 'Create New Flag'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Key</label>
                            <input
                                type="text"
                                value={formData.key}
                                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                                disabled={!!editingFlag}
                                placeholder="my-feature-flag"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="My Feature Flag"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="What does this flag control?"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Rollout Type</label>
                            <select
                                value={formData.rolloutType}
                                onChange={(e) => setFormData({ ...formData, rolloutType: e.target.value as RolloutStrategy['type'] })}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                                <option value="boolean">Boolean (On/Off)</option>
                                <option value="percentage">Percentage Rollout</option>
                                <option value="userIds">Specific Users</option>
                            </select>
                        </div>
                        {formData.rolloutType === 'percentage' && (
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Rollout Percentage: {formData.rolloutPercentage}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={formData.rolloutPercentage}
                                    onChange={(e) => setFormData({ ...formData, rolloutPercentage: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        )}
                        {formData.rolloutType === 'userIds' && (
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">User IDs (comma-separated)</label>
                                <input
                                    type="text"
                                    value={formData.rolloutUserIds}
                                    onChange={(e) => setFormData({ ...formData, rolloutUserIds: e.target.value })}
                                    placeholder="user-1, user-2, user-3"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                        )}
                        <div className="md:col-span-2 flex items-center gap-4">
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={formData.enabled}
                                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                    className="rounded"
                                />
                                Enabled
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={editingFlag ? handleUpdate : handleCreate}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                            {editingFlag ? 'Update' : 'Create'}
                        </button>
                        <button
                            onClick={() => { setShowCreateForm(false); setEditingFlag(null); resetForm(); }}
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Flags List */}
            <div className="space-y-4">
                {flags.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        No feature flags yet. Create your first one!
                    </div>
                ) : (
                    flags.map((flag) => (
                        <div
                            key={flag.key}
                            className="p-4 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-between"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-semibold text-white">{flag.name}</h3>
                                    <span className="text-sm text-gray-500 font-mono">{flag.key}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${flag.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                                        {flag.rollout.type}
                                        {flag.rollout.type === 'percentage' && `: ${flag.rollout.value}%`}
                                    </span>
                                </div>
                                {flag.description && (
                                    <p className="text-sm text-gray-400 mt-1">{flag.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggle(flag)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition ${flag.enabled
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                        }`}
                                >
                                    {flag.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                    onClick={() => startEdit(flag)}
                                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(flag.key)}
                                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
                Feature Flag Management • Zero-cost custom implementation
            </div>
        </div>
    );
}
