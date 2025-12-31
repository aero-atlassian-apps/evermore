/**
 * Error Recovery Strategies - Graceful degradation and fault tolerance.
 * 
 * Implements sophisticated error recovery:
 * - Retry with exponential backoff
 * - Fallback strategies
 * - Circuit breakers
 * - Graceful degradation paths
 * - Error classification and routing
 * 
 * @module ErrorRecovery
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Error categories for routing.
 */
export enum ErrorCategory {
    /** Temporary network issues */
    TRANSIENT = 'TRANSIENT',
    /** Rate limiting */
    RATE_LIMIT = 'RATE_LIMIT',
    /** Invalid input */
    VALIDATION = 'VALIDATION',
    /** Resource not found */
    NOT_FOUND = 'NOT_FOUND',
    /** Permission denied */
    PERMISSION = 'PERMISSION',
    /** Service unavailable */
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    /** Timeout */
    TIMEOUT = 'TIMEOUT',
    /** Unknown/unexpected */
    UNKNOWN = 'UNKNOWN',
    /** Unrecoverable */
    FATAL = 'FATAL',
}

/**
 * Recovery strategy type.
 */
export enum RecoveryStrategy {
    /** Retry the same operation */
    RETRY = 'RETRY',
    /** Use a fallback alternative */
    FALLBACK = 'FALLBACK',
    /** Skip and continue */
    SKIP = 'SKIP',
    /** Abort the operation */
    ABORT = 'ABORT',
    /** Escalate to human */
    ESCALATE = 'ESCALATE',
    /** Queue for later */
    DEFER = 'DEFER',
    /** Use cached result */
    USE_CACHE = 'USE_CACHE',
    /** Use default value */
    USE_DEFAULT = 'USE_DEFAULT',
}

/**
 * Recovery attempt record.
 */
export interface RecoveryAttempt {
    /** Attempt number */
    attempt: number;
    /** Strategy used */
    strategy: RecoveryStrategy;
    /** Whether attempt succeeded */
    success: boolean;
    /** Error if failed */
    error?: Error;
    /** Duration of attempt */
    durationMs: number;
    /** Timestamp */
    timestamp: number;
}

/**
 * Recovery context for decision making.
 */
export interface RecoveryContext {
    /** Original error */
    error: Error;
    /** Error category */
    category: ErrorCategory;
    /** Operation that failed */
    operation: string;
    /** Original input */
    input: unknown;
    /** Previous attempts */
    attempts: RecoveryAttempt[];
    /** Available fallbacks */
    fallbacks: string[];
    /** Whether cached result exists */
    hasCachedResult: boolean;
    /** Default value if available */
    defaultValue?: unknown;
    /** Time elapsed since first attempt */
    totalElapsedMs: number;
    /** Max allowed attempts */
    maxAttempts: number;
    /** Timeout for recovery */
    timeoutMs: number;
}

/**
 * Recovery result.
 */
export interface RecoveryResult<T> {
    /** Whether recovery succeeded */
    success: boolean;
    /** Result if successful */
    result?: T;
    /** Final error if failed */
    error?: Error;
    /** Strategy that worked */
    successfulStrategy?: RecoveryStrategy;
    /** All attempts made */
    attempts: RecoveryAttempt[];
    /** Whether result is degraded */
    isDegraded: boolean;
    /** Degradation description */
    degradationInfo?: string;
}

/**
 * Fallback definition.
 */
export interface FallbackDefinition<T> {
    /** Fallback ID */
    id: string;
    /** Priority (lower = tried first) */
    priority: number;
    /** Conditions when this fallback applies */
    applicableCategories: ErrorCategory[];
    /** The fallback function */
    handler: (context: RecoveryContext) => Promise<T>;
    /** Description */
    description: string;
}

/**
 * Circuit breaker state.
 */
export enum CircuitState {
    CLOSED = 'CLOSED', // Normal operation
    OPEN = 'OPEN', // Rejecting requests
    HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

// ============================================================================
// Error Classifier
// ============================================================================

/**
 * Classifies errors into categories.
 */
export class ErrorClassifier {
    private patterns: Map<ErrorCategory, RegExp[]> = new Map();

    constructor() {
        this.initializePatterns();
    }

    private initializePatterns(): void {
        this.patterns.set(ErrorCategory.TRANSIENT, [
            /ECONNRESET/i,
            /ECONNREFUSED/i,
            /ETIMEDOUT/i,
            /socket hang up/i,
            /network error/i,
        ]);

        this.patterns.set(ErrorCategory.RATE_LIMIT, [
            /rate limit/i,
            /too many requests/i,
            /429/,
            /quota exceeded/i,
        ]);

        this.patterns.set(ErrorCategory.VALIDATION, [
            /invalid/i,
            /validation/i,
            /malformed/i,
            /parse error/i,
        ]);

        this.patterns.set(ErrorCategory.NOT_FOUND, [
            /not found/i,
            /404/,
            /does not exist/i,
        ]);

        this.patterns.set(ErrorCategory.PERMISSION, [
            /unauthorized/i,
            /forbidden/i,
            /403/,
            /401/,
            /access denied/i,
        ]);

        this.patterns.set(ErrorCategory.SERVICE_UNAVAILABLE, [
            /service unavailable/i,
            /503/,
            /502/,
            /bad gateway/i,
        ]);

        this.patterns.set(ErrorCategory.TIMEOUT, [
            /timeout/i,
            /timed out/i,
            /deadline exceeded/i,
        ]);
    }

    /**
     * Classify an error.
     */
    classify(error: Error): ErrorCategory {
        const message = error.message + ' ' + (error.name || '');

        for (const [category, patterns] of this.patterns) {
            for (const pattern of patterns) {
                if (pattern.test(message)) {
                    return category;
                }
            }
        }

        // Check for specific error types
        if (error.name === 'AbortError') return ErrorCategory.TIMEOUT;
        if (error.name === 'TypeError') return ErrorCategory.VALIDATION;

        return ErrorCategory.UNKNOWN;
    }

    /**
     * Check if error is retryable.
     */
    isRetryable(category: ErrorCategory): boolean {
        return [
            ErrorCategory.TRANSIENT,
            ErrorCategory.RATE_LIMIT,
            ErrorCategory.SERVICE_UNAVAILABLE,
            ErrorCategory.TIMEOUT,
        ].includes(category);
    }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker for service protection.
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private successCount: number = 0;

    constructor(
        private readonly name: string,
        private readonly failureThreshold: number = 5,
        private readonly resetTimeMs: number = 30000,
        private readonly halfOpenSuccesses: number = 3
    ) { }

    /**
     * Check if circuit allows request.
     */
    canExecute(): boolean {
        if (this.state === CircuitState.CLOSED) {
            return true;
        }

        if (this.state === CircuitState.OPEN) {
            // Check if reset time has passed
            if (Date.now() - this.lastFailureTime >= this.resetTimeMs) {
                this.state = CircuitState.HALF_OPEN;
                this.successCount = 0;
                return true;
            }
            return false;
        }

        // HALF_OPEN - allow limited requests
        return true;
    }

    /**
     * Record a success.
     */
    recordSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.halfOpenSuccesses) {
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
            }
        } else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success
            this.failureCount = Math.max(0, this.failureCount - 1);
        }
    }

    /**
     * Record a failure.
     */
    recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
        } else if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }

    /**
     * Get current state.
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Force reset.
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
    }

    /**
     * Get stats.
     */
    getStats(): { state: CircuitState; failureCount: number; timeSinceLastFailure: number } {
        return {
            state: this.state,
            failureCount: this.failureCount,
            timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : 0,
        };
    }
}

// ============================================================================
// Recovery Manager
// ============================================================================

/**
 * Manages error recovery with multiple strategies.
 * 
 * Usage:
 * ```typescript
 * const recovery = new RecoveryManager<string>();
 * 
 * // Register fallbacks
 * recovery.registerFallback({
 *   id: 'cache-fallback',
 *   priority: 1,
 *   applicableCategories: [ErrorCategory.TRANSIENT, ErrorCategory.TIMEOUT],
 *   handler: async (ctx) => cachedValue,
 *   description: 'Use cached result',
 * });
 * 
 * // Execute with recovery
 * const result = await recovery.executeWithRecovery(
 *   'fetch-data',
 *   async () => await fetchData(),
 *   { maxAttempts: 3, timeoutMs: 5000 }
 * );
 * ```
 */
export class RecoveryManager<T> {
    private classifier = new ErrorClassifier();
    private fallbacks: FallbackDefinition<T>[] = [];
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private cache: Map<string, { value: T; expiry: number }> = new Map();
    private defaultValues: Map<string, T> = new Map();

    /**
     * Register a fallback.
     */
    registerFallback(fallback: FallbackDefinition<T>): void {
        this.fallbacks.push(fallback);
        this.fallbacks.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Set default value for an operation.
     */
    setDefaultValue(operation: string, value: T): void {
        this.defaultValues.set(operation, value);
    }

    /**
     * Set cached value for an operation.
     */
    setCachedValue(operation: string, value: T, ttlMs: number = 300000): void {
        this.cache.set(operation, { value, expiry: Date.now() + ttlMs });
    }

    /**
     * Get or create circuit breaker.
     */
    getCircuitBreaker(operation: string): CircuitBreaker {
        if (!this.circuitBreakers.has(operation)) {
            this.circuitBreakers.set(operation, new CircuitBreaker(operation));
        }
        return this.circuitBreakers.get(operation)!;
    }

    /**
     * Execute an operation with recovery.
     */
    async executeWithRecovery(
        operation: string,
        fn: () => Promise<T>,
        options: {
            maxAttempts?: number;
            timeoutMs?: number;
            retryDelayMs?: number;
            useCircuitBreaker?: boolean;
        } = {}
    ): Promise<RecoveryResult<T>> {
        const {
            maxAttempts = 3,
            timeoutMs = 30000,
            retryDelayMs = 1000,
            useCircuitBreaker = true,
        } = options;

        const startTime = Date.now();
        const attempts: RecoveryAttempt[] = [];
        const circuitBreaker = useCircuitBreaker ? this.getCircuitBreaker(operation) : null;

        // Check circuit breaker
        if (circuitBreaker && !circuitBreaker.canExecute()) {
            // Circuit is open, try fallbacks immediately
            return await this.tryFallbacks({
                error: new Error('Circuit breaker open'),
                category: ErrorCategory.SERVICE_UNAVAILABLE,
                operation,
                input: undefined,
                attempts: [],
                fallbacks: this.fallbacks.map((f) => f.id),
                hasCachedResult: this.hasCachedValue(operation),
                defaultValue: this.defaultValues.get(operation),
                totalElapsedMs: 0,
                maxAttempts,
                timeoutMs,
            });
        }

        let lastError: Error | undefined;

        // Retry loop
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const attemptStart = Date.now();

            // Check timeout
            if (Date.now() - startTime > timeoutMs) {
                break;
            }

            try {
                const result = await fn();
                circuitBreaker?.recordSuccess();

                return {
                    success: true,
                    result,
                    successfulStrategy: attempt === 1 ? undefined : RecoveryStrategy.RETRY,
                    attempts,
                    isDegraded: false,
                };
            } catch (error) {
                lastError = error as Error;
                const category = this.classifier.classify(lastError);

                attempts.push({
                    attempt,
                    strategy: RecoveryStrategy.RETRY,
                    success: false,
                    error: lastError,
                    durationMs: Date.now() - attemptStart,
                    timestamp: Date.now(),
                });

                circuitBreaker?.recordFailure();

                // Don't retry non-retryable errors
                if (!this.classifier.isRetryable(category)) {
                    break;
                }

                // Wait before retry (exponential backoff)
                if (attempt < maxAttempts) {
                    await this.delay(retryDelayMs * Math.pow(2, attempt - 1));
                }
            }
        }

        // All retries failed, try fallbacks
        const context: RecoveryContext = {
            error: lastError!,
            category: this.classifier.classify(lastError!),
            operation,
            input: undefined,
            attempts,
            fallbacks: this.fallbacks.map((f) => f.id),
            hasCachedResult: this.hasCachedValue(operation),
            defaultValue: this.defaultValues.get(operation),
            totalElapsedMs: Date.now() - startTime,
            maxAttempts,
            timeoutMs,
        };

        return await this.tryFallbacks(context);
    }

    /**
     * Try fallback strategies.
     */
    private async tryFallbacks(context: RecoveryContext): Promise<RecoveryResult<T>> {
        // Try cached value first
        if (context.hasCachedResult) {
            const cached = this.getCachedValue(context.operation);
            if (cached !== undefined) {
                context.attempts.push({
                    attempt: context.attempts.length + 1,
                    strategy: RecoveryStrategy.USE_CACHE,
                    success: true,
                    durationMs: 0,
                    timestamp: Date.now(),
                });

                return {
                    success: true,
                    result: cached,
                    successfulStrategy: RecoveryStrategy.USE_CACHE,
                    attempts: context.attempts,
                    isDegraded: true,
                    degradationInfo: 'Using cached result',
                };
            }
        }

        // Try registered fallbacks
        const applicableFallbacks = this.fallbacks.filter((f) =>
            f.applicableCategories.includes(context.category)
        );

        for (const fallback of applicableFallbacks) {
            const attemptStart = Date.now();

            try {
                const result = await fallback.handler(context);

                context.attempts.push({
                    attempt: context.attempts.length + 1,
                    strategy: RecoveryStrategy.FALLBACK,
                    success: true,
                    durationMs: Date.now() - attemptStart,
                    timestamp: Date.now(),
                });

                return {
                    success: true,
                    result,
                    successfulStrategy: RecoveryStrategy.FALLBACK,
                    attempts: context.attempts,
                    isDegraded: true,
                    degradationInfo: `Used fallback: ${fallback.description}`,
                };
            } catch (error) {
                context.attempts.push({
                    attempt: context.attempts.length + 1,
                    strategy: RecoveryStrategy.FALLBACK,
                    success: false,
                    error: error as Error,
                    durationMs: Date.now() - attemptStart,
                    timestamp: Date.now(),
                });
            }
        }

        // Try default value
        if (context.defaultValue !== undefined) {
            context.attempts.push({
                attempt: context.attempts.length + 1,
                strategy: RecoveryStrategy.USE_DEFAULT,
                success: true,
                durationMs: 0,
                timestamp: Date.now(),
            });

            return {
                success: true,
                result: context.defaultValue as T,
                successfulStrategy: RecoveryStrategy.USE_DEFAULT,
                attempts: context.attempts,
                isDegraded: true,
                degradationInfo: 'Using default value',
            };
        }

        // All recovery failed
        return {
            success: false,
            error: context.error,
            attempts: context.attempts,
            isDegraded: false,
        };
    }

    /**
     * Check if cached value exists and is valid.
     */
    private hasCachedValue(operation: string): boolean {
        const cached = this.cache.get(operation);
        return cached !== undefined && cached.expiry > Date.now();
    }

    /**
     * Get cached value if valid.
     */
    private getCachedValue(operation: string): T | undefined {
        const cached = this.cache.get(operation);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }
        this.cache.delete(operation);
        return undefined;
    }

    /**
     * Delay utility.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get recovery stats.
     */
    getStats(): {
        circuitBreakers: Record<string, { state: CircuitState; failureCount: number }>;
        fallbackCount: number;
        cacheSize: number;
    } {
        const circuitBreakers: Record<string, { state: CircuitState; failureCount: number }> = {};
        for (const [name, breaker] of this.circuitBreakers) {
            const stats = breaker.getStats();
            circuitBreakers[name] = { state: stats.state, failureCount: stats.failureCount };
        }

        return {
            circuitBreakers,
            fallbackCount: this.fallbacks.length,
            cacheSize: this.cache.size,
        };
    }
}
