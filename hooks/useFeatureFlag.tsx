'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import type { EvaluationResult, EvaluationContext } from '@/lib/core/application/services/flags/types';

// ============================================================================
// Types
// ============================================================================

interface FeatureFlagContextValue {
    /** User context for flag evaluation */
    context: EvaluationContext;
    /** Update user context */
    setContext: (context: EvaluationContext) => void;
    /** Cached flag results */
    cache: Map<string, EvaluationResult>;
    /** Invalidate cache */
    invalidateCache: () => void;
}

interface UseFeatureFlagResult {
    /** Whether the feature is enabled */
    enabled: boolean;
    /** Assigned variant (if A/B test) */
    variant: string | null;
    /** Variant payload data */
    payload: Record<string, unknown> | null;
    /** Loading state */
    loading: boolean;
    /** Error if evaluation failed */
    error: Error | null;
    /** Refresh the flag evaluation */
    refresh: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

/**
 * Provider for feature flag context.
 */
export function FeatureFlagProvider({
    children,
    defaultContext = {}
}: {
    children: ReactNode;
    defaultContext?: EvaluationContext;
}) {
    const [context, setContext] = useState<EvaluationContext>(defaultContext);
    const [cache] = useState(() => new Map<string, EvaluationResult>());

    const invalidateCache = useCallback(() => {
        cache.clear();
    }, [cache]);

    return (
        <FeatureFlagContext.Provider value={{ context, setContext, cache, invalidateCache }}>
            {children}
        </FeatureFlagContext.Provider>
    );
}

// ============================================================================
// Hook: useFeatureFlag
// ============================================================================

/**
 * React hook for feature flag evaluation.
 * 
 * @example
 * ```tsx
 * const { enabled, variant, loading } = useFeatureFlag('new-onboarding');
 * 
 * if (loading) return <Spinner />;
 * if (!enabled) return <OldOnboarding />;
 * return <NewOnboarding variant={variant} />;
 * ```
 */
export function useFeatureFlag(
    key: string,
    options: {
        context?: EvaluationContext;
        defaultValue?: boolean;
    } = {}
): UseFeatureFlagResult {
    const flagContext = useContext(FeatureFlagContext);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const evaluateFlag = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Check cache first
            const cached = flagContext?.cache.get(key);
            if (cached) {
                setResult(cached);
                setLoading(false);
                return;
            }

            // Merge contexts
            const context: EvaluationContext = {
                ...flagContext?.context,
                ...options.context,
            };

            // Call evaluation API
            const response = await fetch('/api/flags/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, context }),
            });

            if (!response.ok) {
                throw new Error(`Flag evaluation failed: ${response.status}`);
            }

            const evalResult: EvaluationResult = await response.json();
            setResult(evalResult);

            // Cache result
            flagContext?.cache.set(key, evalResult);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [key, flagContext, options.context]);

    useEffect(() => {
        evaluateFlag();
    }, [evaluateFlag]);

    return {
        enabled: result?.enabled ?? options.defaultValue ?? false,
        variant: result?.variant ?? null,
        payload: result?.payload ?? null,
        loading,
        error,
        refresh: evaluateFlag,
    };
}

// ============================================================================
// Hook: useFeatureFlags (Batch)
// ============================================================================

/**
 * Evaluate multiple feature flags at once.
 */
export function useFeatureFlags(
    keys: string[],
    context?: EvaluationContext
): Map<string, UseFeatureFlagResult> {
    const results = new Map<string, UseFeatureFlagResult>();

    for (const key of keys) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const result = useFeatureFlag(key, { context });
        results.set(key, result);
    }

    return results;
}

// ============================================================================
// Component: Feature
// ============================================================================

interface FeatureProps {
    /** Feature flag key */
    flag: string;
    /** Content to show when enabled */
    children: ReactNode;
    /** Optional fallback when disabled */
    fallback?: ReactNode;
    /** Loading state content */
    loading?: ReactNode;
    /** Optional context override */
    context?: EvaluationContext;
}

/**
 * Declarative feature flag component.
 * 
 * @example
 * ```tsx
 * <Feature flag="new-checkout" fallback={<OldCheckout />}>
 *   <NewCheckout />
 * </Feature>
 * ```
 */
export function Feature({
    flag,
    children,
    fallback = null,
    loading: loadingContent = null,
    context,
}: FeatureProps) {
    const { enabled, loading } = useFeatureFlag(flag, { context });

    if (loading && loadingContent) {
        return <>{loadingContent}</>;
    }

    return enabled ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// Component: ABTest
// ============================================================================

interface ABTestProps {
    /** Feature flag key */
    flag: string;
    /** Variant renderers */
    variants: Record<string, ReactNode>;
    /** Default variant if none assigned */
    defaultVariant?: string;
    /** Loading state content */
    loading?: ReactNode;
    /** Optional context override */
    context?: EvaluationContext;
}

/**
 * A/B test component with variant rendering.
 * 
 * @example
 * ```tsx
 * <ABTest 
 *   flag="checkout-variant" 
 *   variants={{
 *     control: <OldCheckout />,
 *     treatment: <NewCheckout />,
 *   }}
 *   defaultVariant="control"
 * />
 * ```
 */
export function ABTest({
    flag,
    variants,
    defaultVariant,
    loading: loadingContent = null,
    context,
}: ABTestProps) {
    const { enabled, variant, loading } = useFeatureFlag(flag, { context });

    if (loading && loadingContent) {
        return <>{loadingContent}</>;
    }

    if (!enabled) {
        return defaultVariant ? <>{variants[defaultVariant]}</> : null;
    }

    const activeVariant = variant || defaultVariant;
    if (!activeVariant || !variants[activeVariant]) {
        return null;
    }

    return <>{variants[activeVariant]}</>;
}
