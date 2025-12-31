/**
 * LLM Usage Tracking - Token counting and cost management.
 * 
 * Tracks token usage per request for:
 * - Cost monitoring and billing
 * - Budget enforcement
 * - Usage analytics
 * 
 * @module LLMUsageTracker
 */

import { logger } from '../Logger';

// ============================================================================
// Types
// ============================================================================

export interface LLMUsageRecord {
    /** Unique request ID */
    requestId: string;
    /** User ID if available */
    userId?: string;
    /** Session ID if available */
    sessionId?: string;
    /** Model used */
    model: string;
    /** Provider (google_ai, huggingface, vertex) */
    provider: string;
    /** Input tokens */
    inputTokens: number;
    /** Output tokens */
    outputTokens: number;
    /** Total tokens */
    totalTokens: number;
    /** Estimated cost in cents */
    estimatedCostCents: number;
    /** Request type/purpose */
    purpose: string;
    /** Duration in milliseconds */
    durationMs: number;
    /** Success status */
    success: boolean;
    /** Timestamp */
    timestamp: Date;
}

export interface TokenBudget {
    /** Maximum tokens per request */
    maxTokensPerRequest: number;
    /** Maximum daily tokens per user */
    maxDailyTokensPerUser: number;
    /** Maximum monthly tokens per user */
    maxMonthlyTokensPerUser: number;
    /** Alert threshold (percentage) */
    alertThreshold: number;
}

interface UserUsage {
    dailyTokens: number;
    monthlyTokens: number;
    dailyReset: Date;
    monthlyReset: Date;
    requestCount: number;
}

// ============================================================================
// Cost Configuration (prices per 1M tokens in cents)
// ============================================================================

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    // Google AI Studio
    'gemini-1.5-flash': { input: 7.5, output: 30 },
    'gemini-1.5-pro': { input: 125, output: 500 },
    'gemini-2.0-flash': { input: 7.5, output: 30 },
    // Vertex AI
    'gemini-1.5-pro-001': { input: 125, output: 500 },
    // HuggingFace (free but tracking for analytics)
    'mistralai/Mistral-7B-Instruct-v0.2': { input: 0, output: 0 },
    // Default
    'default': { input: 10, output: 40 },
};

// ============================================================================
// LLM Usage Tracker
// ============================================================================

export class LLMUsageTracker {
    private static instance: LLMUsageTracker;
    private records: LLMUsageRecord[] = [];
    private userUsage: Map<string, UserUsage> = new Map();
    private budget: TokenBudget;
    private maxRecords: number = 10000;

    private constructor(budget?: Partial<TokenBudget>) {
        this.budget = {
            maxTokensPerRequest: budget?.maxTokensPerRequest || 8000,
            maxDailyTokensPerUser: budget?.maxDailyTokensPerUser || 100000,
            maxMonthlyTokensPerUser: budget?.maxMonthlyTokensPerUser || 1000000,
            alertThreshold: budget?.alertThreshold || 80,
        };
    }

    static getInstance(budget?: Partial<TokenBudget>): LLMUsageTracker {
        if (!LLMUsageTracker.instance) {
            LLMUsageTracker.instance = new LLMUsageTracker(budget);
        }
        return LLMUsageTracker.instance;
    }

    // ============================================================================
    // Recording
    // ============================================================================

    /**
     * Record an LLM usage event.
     */
    record(record: Omit<LLMUsageRecord, 'estimatedCostCents' | 'totalTokens' | 'timestamp'>): void {
        const totalTokens = record.inputTokens + record.outputTokens;
        const estimatedCostCents = this.calculateCost(
            record.model,
            record.inputTokens,
            record.outputTokens
        );

        const fullRecord: LLMUsageRecord = {
            ...record,
            totalTokens,
            estimatedCostCents,
            timestamp: new Date(),
        };

        // Store record
        this.records.push(fullRecord);

        // Enforce max records (LRU eviction)
        if (this.records.length > this.maxRecords) {
            this.records.shift();
        }

        // Update user usage
        if (record.userId) {
            this.updateUserUsage(record.userId, totalTokens);
        }

        // Log for observability
        logger.info('LLM usage recorded', {
            requestId: record.requestId,
            model: record.model,
            provider: record.provider,
            inputTokens: record.inputTokens,
            outputTokens: record.outputTokens,
            totalTokens,
            costCents: estimatedCostCents.toFixed(4),
            purpose: record.purpose,
            durationMs: record.durationMs,
            userId: record.userId,
        });
    }

    /**
     * Calculate cost in cents.
     */
    private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
        const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
        // Cost is per 1M tokens, convert to actual
        const inputCost = (inputTokens / 1_000_000) * costs.input;
        const outputCost = (outputTokens / 1_000_000) * costs.output;
        return inputCost + outputCost;
    }

    /**
     * Estimate tokens from text (rough approximation: 4 chars ≈ 1 token).
     */
    estimateTokens(text: string): number {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    // ============================================================================
    // Budget Checking
    // ============================================================================

    /**
     * Check if a request is within budget.
     */
    checkBudget(userId: string, estimatedTokens: number): {
        allowed: boolean;
        reason?: string;
        usage?: UserUsage;
    } {
        // Check per-request limit
        if (estimatedTokens > this.budget.maxTokensPerRequest) {
            return {
                allowed: false,
                reason: `Request exceeds maximum tokens (${estimatedTokens} > ${this.budget.maxTokensPerRequest})`,
            };
        }

        // Get user usage
        const usage = this.getUserUsage(userId);

        // Check daily limit
        if (usage.dailyTokens + estimatedTokens > this.budget.maxDailyTokensPerUser) {
            return {
                allowed: false,
                reason: `Daily token limit exceeded (${usage.dailyTokens} / ${this.budget.maxDailyTokensPerUser})`,
                usage,
            };
        }

        // Check monthly limit
        if (usage.monthlyTokens + estimatedTokens > this.budget.maxMonthlyTokensPerUser) {
            return {
                allowed: false,
                reason: `Monthly token limit exceeded (${usage.monthlyTokens} / ${this.budget.maxMonthlyTokensPerUser})`,
                usage,
            };
        }

        // Check if approaching limits (warning)
        const dailyPercentage = ((usage.dailyTokens + estimatedTokens) / this.budget.maxDailyTokensPerUser) * 100;
        if (dailyPercentage >= this.budget.alertThreshold) {
            logger.warn('User approaching daily token limit', {
                userId,
                dailyUsage: usage.dailyTokens,
                dailyLimit: this.budget.maxDailyTokensPerUser,
                percentage: dailyPercentage.toFixed(1),
            });
        }

        return { allowed: true, usage };
    }

    /**
     * Get user usage with reset logic.
     */
    private getUserUsage(userId: string): UserUsage {
        const now = new Date();
        let usage = this.userUsage.get(userId);

        if (!usage) {
            usage = {
                dailyTokens: 0,
                monthlyTokens: 0,
                dailyReset: this.getNextDayReset(),
                monthlyReset: this.getNextMonthReset(),
                requestCount: 0,
            };
            this.userUsage.set(userId, usage);
        }

        // Reset daily if needed
        if (now >= usage.dailyReset) {
            usage.dailyTokens = 0;
            usage.dailyReset = this.getNextDayReset();
        }

        // Reset monthly if needed
        if (now >= usage.monthlyReset) {
            usage.monthlyTokens = 0;
            usage.monthlyReset = this.getNextMonthReset();
        }

        return usage;
    }

    /**
     * Update user usage after request.
     */
    private updateUserUsage(userId: string, tokens: number): void {
        const usage = this.getUserUsage(userId);
        usage.dailyTokens += tokens;
        usage.monthlyTokens += tokens;
        usage.requestCount++;
    }

    private getNextDayReset(): Date {
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        return tomorrow;
    }

    private getNextMonthReset(): Date {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
    }

    // ============================================================================
    // Analytics
    // ============================================================================

    /**
     * Get usage summary for a time period.
     */
    getSummary(since?: Date): {
        totalRecords: number;
        totalTokens: number;
        totalCostCents: number;
        averageTokensPerRequest: number;
        byModel: Record<string, { tokens: number; cost: number; requests: number }>;
        byPurpose: Record<string, { tokens: number; cost: number; requests: number }>;
    } {
        const startDate = since || new Date(0);
        const filtered = this.records.filter(r => r.timestamp >= startDate);

        const byModel: Record<string, { tokens: number; cost: number; requests: number }> = {};
        const byPurpose: Record<string, { tokens: number; cost: number; requests: number }> = {};

        let totalTokens = 0;
        let totalCost = 0;

        for (const record of filtered) {
            totalTokens += record.totalTokens;
            totalCost += record.estimatedCostCents;

            // By model
            if (!byModel[record.model]) {
                byModel[record.model] = { tokens: 0, cost: 0, requests: 0 };
            }
            byModel[record.model].tokens += record.totalTokens;
            byModel[record.model].cost += record.estimatedCostCents;
            byModel[record.model].requests++;

            // By purpose
            if (!byPurpose[record.purpose]) {
                byPurpose[record.purpose] = { tokens: 0, cost: 0, requests: 0 };
            }
            byPurpose[record.purpose].tokens += record.totalTokens;
            byPurpose[record.purpose].cost += record.estimatedCostCents;
            byPurpose[record.purpose].requests++;
        }

        return {
            totalRecords: filtered.length,
            totalTokens,
            totalCostCents: totalCost,
            averageTokensPerRequest: filtered.length > 0 ? totalTokens / filtered.length : 0,
            byModel,
            byPurpose,
        };
    }

    /**
     * Get user usage stats.
     */
    getUserStats(userId: string): UserUsage | null {
        return this.userUsage.get(userId) || null;
    }

    /**
     * Export recent records for analysis (last 24 hours).
     */
    exportRecent(hours: number = 24): LLMUsageRecord[] {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.records.filter(r => r.timestamp >= since);
    }
}

// Singleton export
export const llmUsageTracker = LLMUsageTracker.getInstance();
