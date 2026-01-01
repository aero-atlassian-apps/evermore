/**
 * Chaos Testing Framework
 * 
 * Enables controlled failure injection for resilience testing.
 * Used to verify graceful degradation of adapters.
 * 
 * Usage:
 * ```typescript
 * // In test setup
 * enableChaos('redis', 'connection_refused');
 * 
 * // In adapter
 * if (shouldInjectFailure('redis')) {
 *   throw new Error('Chaos: Connection refused');
 * }
 * 
 * // Cleanup
 * disableChaos('redis');
 * ```
 */

export type ChaosAdapter =
    | 'redis'
    | 'supabase'
    | 'vertex-ai'
    | 'elevenlabs'
    | 'pinecone';

export type ChaosMode =
    | 'connection_refused'
    | 'timeout'
    | 'service_unavailable'
    | 'quota_exceeded'
    | 'random_failure';

interface ChaosConfig {
    adapter: ChaosAdapter;
    mode: ChaosMode;
    probability: number; // 0-1, 1 = always fail
    delayMs?: number; // For timeout simulation
    expiresAt?: number; // Auto-disable after timestamp
}

// Global chaos state (in-memory, test-only)
const chaosState = new Map<ChaosAdapter, ChaosConfig>();

/**
 * Enable chaos for an adapter
 */
export function enableChaos(
    adapter: ChaosAdapter,
    mode: ChaosMode,
    options?: { probability?: number; delayMs?: number; durationMs?: number }
): void {
    if (process.env.NODE_ENV === 'production') {
        console.warn('[Chaos] Chaos testing is disabled in production');
        return;
    }

    const config: ChaosConfig = {
        adapter,
        mode,
        probability: options?.probability ?? 1,
        delayMs: options?.delayMs,
        expiresAt: options?.durationMs ? Date.now() + options.durationMs : undefined,
    };

    chaosState.set(adapter, config);
    console.log(`[Chaos] Enabled ${mode} for ${adapter}`);
}

/**
 * Disable chaos for an adapter
 */
export function disableChaos(adapter: ChaosAdapter): void {
    chaosState.delete(adapter);
    console.log(`[Chaos] Disabled for ${adapter}`);
}

/**
 * Disable all chaos
 */
export function disableAllChaos(): void {
    chaosState.clear();
    console.log('[Chaos] All chaos disabled');
}

/**
 * Check if failure should be injected
 */
export function shouldInjectFailure(adapter: ChaosAdapter): boolean {
    // Never inject in production
    if (process.env.NODE_ENV === 'production') return false;

    // Check env flag
    if (process.env.CHAOS_ENABLED !== 'true') return false;

    const config = chaosState.get(adapter);
    if (!config) return false;

    // Check expiration
    if (config.expiresAt && Date.now() > config.expiresAt) {
        chaosState.delete(adapter);
        return false;
    }

    // Check probability
    return Math.random() < config.probability;
}

/**
 * Get chaos error for adapter
 */
export function getChaosError(adapter: ChaosAdapter): Error {
    const config = chaosState.get(adapter);
    const mode = config?.mode || 'random_failure';

    const errors: Record<ChaosMode, string> = {
        connection_refused: `[Chaos] ${adapter}: Connection refused`,
        timeout: `[Chaos] ${adapter}: Request timeout`,
        service_unavailable: `[Chaos] ${adapter}: Service unavailable (503)`,
        quota_exceeded: `[Chaos] ${adapter}: Quota exceeded`,
        random_failure: `[Chaos] ${adapter}: Random failure`,
    };

    return new Error(errors[mode]);
}

/**
 * Inject delay for timeout simulation
 */
export async function injectChaosDelay(adapter: ChaosAdapter): Promise<void> {
    const config = chaosState.get(adapter);
    if (config?.delayMs) {
        await new Promise(resolve => setTimeout(resolve, config.delayMs));
    }
}

/**
 * Wrapper for chaos-aware operations
 */
export async function withChaos<T>(
    adapter: ChaosAdapter,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
): Promise<T> {
    if (shouldInjectFailure(adapter)) {
        await injectChaosDelay(adapter);

        if (fallback) {
            console.log(`[Chaos] ${adapter} failed, using fallback`);
            return fallback();
        }

        throw getChaosError(adapter);
    }

    return operation();
}

/**
 * Get current chaos status
 */
export function getChaosStatus(): Record<ChaosAdapter, ChaosConfig | null> {
    const status: Record<string, ChaosConfig | null> = {};

    const adapters: ChaosAdapter[] = ['redis', 'supabase', 'vertex-ai', 'elevenlabs', 'pinecone'];
    for (const adapter of adapters) {
        status[adapter] = chaosState.get(adapter) || null;
    }

    return status as Record<ChaosAdapter, ChaosConfig | null>;
}
