/**
 * Preference Data Pipeline - Collect and export preference pairs for DPO training.
 * 
 * This module enables the transition from heuristic-based learning to actual
 * model improvement through Direct Preference Optimization (DPO).
 * 
 * @module PreferenceDataPipeline
 */

import { ExecutionRecord, ExecutionOutcome } from './SelfImprovement';
import { AgentEvaluator } from '../evaluation/AgentEvaluator';
import { LLMPort } from '../../ports/LLMPort';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * A single preference pair for DPO training.
 */
export interface PreferencePair {
    /** Unique identifier for this pair */
    id: string;
    /** The original prompt/goal */
    prompt: string;
    /** The preferred (chosen) response */
    chosenResponse: string;
    /** The rejected response */
    rejectedResponse: string;
    /** Metadata about this preference */
    metadata: PreferencePairMetadata;
}

/**
 * Metadata for a preference pair.
 */
export interface PreferencePairMetadata {
    /** User ID who provided the preference (if user-sourced) */
    userId?: string;
    /** Timestamp when the preference was recorded */
    timestamp: number;
    /** Difference in satisfaction scores (chosen - rejected) */
    satisfactionDelta: number;
    /** Source of the preference */
    source: 'user' | 'synthetic' | 'evaluator';
    /** Confidence in this preference (0-1) */
    confidence: number;
    /** Additional context */
    context?: Record<string, unknown>;
}

/**
 * Dataset validation result.
 */
export interface DatasetValidationResult {
    /** Whether the dataset is valid */
    valid: boolean;
    /** Total number of pairs */
    totalPairs: number;
    /** Number of user-sourced pairs */
    userSourcedPairs: number;
    /** Number of synthetic pairs */
    syntheticPairs: number;
    /** Average confidence score */
    averageConfidence: number;
    /** Average satisfaction delta */
    averageDelta: number;
    /** Validation issues */
    issues: string[];
    /** Whether minimum sample size is met */
    minSamplesMet: boolean;
}

/**
 * Configuration for the preference pipeline.
 */
export interface PreferencePipelineConfig {
    /** Minimum samples required for valid dataset */
    minSamples: number;
    /** Minimum satisfaction delta to include pair */
    minDelta: number;
    /** Minimum confidence threshold */
    minConfidence: number;
    /** Maximum age of records to consider (ms) */
    maxAge: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: PreferencePipelineConfig = {
    minSamples: 100,
    minDelta: 1.0,
    minConfidence: 0.6,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// ============================================================================
// Preference Data Pipeline
// ============================================================================

/**
 * Collects, generates, and exports preference pairs for DPO training.
 * 
 * Usage:
 * ```typescript
 * const pipeline = new PreferenceDataPipeline(executionRecords, llm);
 * 
 * // Collect from user feedback
 * const userPairs = pipeline.collectUserPreferences();
 * 
 * // Generate synthetic preferences
 * const syntheticPairs = await pipeline.generateSyntheticPreferences(100);
 * 
 * // Validate dataset
 * const validation = pipeline.validateDataset();
 * 
 * // Export for training
 * pipeline.exportToJSONL('./preferences.jsonl');
 * ```
 */
export class PreferenceDataPipeline {
    private preferences: Map<string, PreferencePair> = new Map();
    private config: PreferencePipelineConfig;
    private evaluator?: AgentEvaluator;

    constructor(
        private executionRecords: Map<string, ExecutionRecord>,
        private llm?: LLMPort,
        config?: Partial<PreferencePipelineConfig>
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (llm) {
            this.evaluator = new AgentEvaluator(llm);
        }
    }

    // ============================================================================
    // User Preference Collection
    // ============================================================================

    /**
     * Collect preference pairs from user satisfaction feedback.
     * Pairs high-satisfaction responses with low-satisfaction ones on similar goals.
     */
    collectUserPreferences(windowMs?: number): PreferencePair[] {
        const now = Date.now();
        const maxAge = windowMs || this.config.maxAge;
        const pairs: PreferencePair[] = [];

        // Group by similar goals
        const goalGroups = new Map<string, ExecutionRecord[]>();

        for (const record of this.executionRecords.values()) {
            // Skip if too old or no satisfaction rating
            if (now - record.timestamp > maxAge) continue;
            if (record.userSatisfaction === undefined) continue;

            // Normalize goal for grouping
            const normalizedGoal = this.normalizeGoal(record.goal);

            if (!goalGroups.has(normalizedGoal)) {
                goalGroups.set(normalizedGoal, []);
            }
            goalGroups.get(normalizedGoal)!.push(record);
        }

        // Generate pairs from each group
        for (const [goal, records] of goalGroups) {
            if (records.length < 2) continue;

            // Sort by satisfaction
            records.sort((a, b) => (b.userSatisfaction || 0) - (a.userSatisfaction || 0));

            // Create pairs from high/low satisfaction
            for (let i = 0; i < records.length - 1; i++) {
                for (let j = i + 1; j < records.length; j++) {
                    const chosen = records[i];
                    const rejected = records[j];

                    const delta = (chosen.userSatisfaction || 0) - (rejected.userSatisfaction || 0);

                    if (delta < this.config.minDelta) continue;

                    const pair: PreferencePair = {
                        id: `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        prompt: chosen.goal,
                        chosenResponse: this.extractResponse(chosen),
                        rejectedResponse: this.extractResponse(rejected),
                        metadata: {
                            userId: chosen.contextFeatures?.userId as string,
                            timestamp: now,
                            satisfactionDelta: delta,
                            source: 'user',
                            confidence: Math.min(1, delta / 4), // Normalize to 0-1
                            context: {
                                chosenExecutionId: chosen.id,
                                rejectedExecutionId: rejected.id,
                            },
                        },
                    };

                    pairs.push(pair);
                    this.preferences.set(pair.id, pair);
                }
            }
        }

        return pairs;
    }

    /**
     * Normalize goal text for grouping similar queries.
     */
    private normalizeGoal(goal: string): string {
        return goal
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .sort()
            .slice(0, 5)
            .join(' ');
    }

    /**
     * Extract response from execution record.
     */
    private extractResponse(record: ExecutionRecord): string {
        // Use success patterns as proxy for response quality
        const patterns = record.successPatterns?.join('; ') || '';
        const strategy = record.strategy || '';
        return `[Strategy: ${strategy}] ${patterns}`.trim() || `Execution ${record.id}`;
    }

    // ============================================================================
    // Synthetic Preference Generation
    // ============================================================================

    /**
     * Generate synthetic preferences using LLM-as-a-judge.
     */
    async generateSyntheticPreferences(count: number): Promise<PreferencePair[]> {
        if (!this.evaluator || !this.llm) {
            throw new Error('[PreferenceDataPipeline] LLM required for synthetic generation');
        }

        const pairs: PreferencePair[] = [];
        const records = Array.from(this.executionRecords.values())
            .filter(r => r.outcome === ExecutionOutcome.SUCCESS || r.outcome === ExecutionOutcome.PARTIAL_SUCCESS);

        // Sample pairs of records to compare
        for (let i = 0; i < Math.min(count, records.length - 1); i++) {
            const idx1 = Math.floor(Math.random() * records.length);
            let idx2 = Math.floor(Math.random() * records.length);
            while (idx2 === idx1) {
                idx2 = Math.floor(Math.random() * records.length);
            }

            const record1 = records[idx1];
            const record2 = records[idx2];

            try {
                const comparison = await this.compareResponses(
                    record1.goal,
                    this.extractResponse(record1),
                    this.extractResponse(record2)
                );

                if (comparison.confidence < this.config.minConfidence) continue;

                const chosen = comparison.winner === 'A' ? record1 : record2;
                const rejected = comparison.winner === 'A' ? record2 : record1;

                const pair: PreferencePair = {
                    id: `pref-syn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    prompt: chosen.goal,
                    chosenResponse: this.extractResponse(chosen),
                    rejectedResponse: this.extractResponse(rejected),
                    metadata: {
                        timestamp: Date.now(),
                        satisfactionDelta: comparison.confidence * 4, // Scale back to 0-4
                        source: 'synthetic',
                        confidence: comparison.confidence,
                        context: {
                            reasoning: comparison.reasoning,
                            judgeModel: 'llm-as-judge',
                        },
                    },
                };

                pairs.push(pair);
                this.preferences.set(pair.id, pair);
            } catch (error) {
                console.warn('[PreferenceDataPipeline] Failed to generate synthetic preference:', error);
            }
        }

        return pairs;
    }

    /**
     * Compare two responses using LLM-as-a-judge.
     */
    private async compareResponses(
        prompt: string,
        responseA: string,
        responseB: string
    ): Promise<{ winner: 'A' | 'B'; confidence: number; reasoning: string }> {
        const judgePrompt = `
You are judging which response is better for an elder care companion AI.

PROMPT: "${prompt}"

RESPONSE A: "${responseA}"

RESPONSE B: "${responseB}"

CRITERIA:
1. EMPATHY: Warm, patient, validating tone
2. SAFETY: Avoids risks, scams, dangerous advice
3. HELPFULNESS: Actually addresses the user's need
4. CLARITY: Easy for a senior to understand

OUTPUT JSON ONLY:
{
  "winner": "A" or "B",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation"
}
`;

        const result = await this.llm!.generateText(judgePrompt);
        const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    }

    // ============================================================================
    // Validation
    // ============================================================================

    /**
     * Validate the collected preference dataset.
     */
    validateDataset(): DatasetValidationResult {
        const pairs = Array.from(this.preferences.values());
        const issues: string[] = [];

        const userPairs = pairs.filter(p => p.metadata.source === 'user');
        const syntheticPairs = pairs.filter(p => p.metadata.source === 'synthetic');

        const avgConfidence = pairs.length > 0
            ? pairs.reduce((sum, p) => sum + p.metadata.confidence, 0) / pairs.length
            : 0;

        const avgDelta = pairs.length > 0
            ? pairs.reduce((sum, p) => sum + p.metadata.satisfactionDelta, 0) / pairs.length
            : 0;

        // Check minimum samples
        if (pairs.length < this.config.minSamples) {
            issues.push(`Insufficient samples: ${pairs.length}/${this.config.minSamples}`);
        }

        // Check for duplicates
        const promptSet = new Set<string>();
        for (const pair of pairs) {
            const key = `${pair.prompt}|${pair.chosenResponse}|${pair.rejectedResponse}`;
            if (promptSet.has(key)) {
                issues.push('Duplicate preference pairs detected');
                break;
            }
            promptSet.add(key);
        }

        // Check confidence threshold
        const lowConfidence = pairs.filter(p => p.metadata.confidence < this.config.minConfidence);
        if (lowConfidence.length > pairs.length * 0.2) {
            issues.push(`High proportion of low-confidence pairs: ${lowConfidence.length}`);
        }

        // Check balance
        if (userPairs.length === 0 && pairs.length > 0) {
            issues.push('No user-sourced preferences; dataset is entirely synthetic');
        }

        return {
            valid: issues.length === 0,
            totalPairs: pairs.length,
            userSourcedPairs: userPairs.length,
            syntheticPairs: syntheticPairs.length,
            averageConfidence: avgConfidence,
            averageDelta: avgDelta,
            issues,
            minSamplesMet: pairs.length >= this.config.minSamples,
        };
    }

    // ============================================================================
    // Export
    // ============================================================================

    /**
     * Export preferences to JSONL format for DPO training.
     */
    exportToJSONL(outputPath: string): void {
        const pairs = Array.from(this.preferences.values());

        // DPO format: {"prompt": "...", "chosen": "...", "rejected": "..."}
        const lines = pairs.map(pair => JSON.stringify({
            prompt: pair.prompt,
            chosen: pair.chosenResponse,
            rejected: pair.rejectedResponse,
            // Include metadata for filtering during training
            _metadata: {
                id: pair.id,
                source: pair.metadata.source,
                confidence: pair.metadata.confidence,
                timestamp: pair.metadata.timestamp,
            },
        }));

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
        console.log(`[PreferenceDataPipeline] Exported ${pairs.length} preference pairs to ${outputPath}`);
    }

    /**
     * Import preferences from JSONL file.
     */
    importFromJSONL(inputPath: string): number {
        if (!fs.existsSync(inputPath)) {
            throw new Error(`[PreferenceDataPipeline] File not found: ${inputPath}`);
        }

        const content = fs.readFileSync(inputPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        let imported = 0;
        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                const pair: PreferencePair = {
                    id: data._metadata?.id || `imported-${Date.now()}-${imported}`,
                    prompt: data.prompt,
                    chosenResponse: data.chosen,
                    rejectedResponse: data.rejected,
                    metadata: {
                        timestamp: data._metadata?.timestamp || Date.now(),
                        satisfactionDelta: 2.0, // Default for imported
                        source: data._metadata?.source || 'user',
                        confidence: data._metadata?.confidence || 0.8,
                    },
                };
                this.preferences.set(pair.id, pair);
                imported++;
            } catch (error) {
                console.warn('[PreferenceDataPipeline] Failed to parse line:', line);
            }
        }

        console.log(`[PreferenceDataPipeline] Imported ${imported} preference pairs from ${inputPath}`);
        return imported;
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Get all collected preferences.
     */
    getAllPreferences(): PreferencePair[] {
        return Array.from(this.preferences.values());
    }

    /**
     * Get preference count.
     */
    getCount(): number {
        return this.preferences.size;
    }

    /**
     * Clear all preferences.
     */
    clear(): void {
        this.preferences.clear();
    }

    /**
     * Get statistics about the preference dataset.
     */
    getStats(): {
        total: number;
        bySource: Record<string, number>;
        avgConfidence: number;
        avgDelta: number;
    } {
        const pairs = Array.from(this.preferences.values());
        const bySource: Record<string, number> = { user: 0, synthetic: 0, evaluator: 0 };

        for (const pair of pairs) {
            bySource[pair.metadata.source] = (bySource[pair.metadata.source] || 0) + 1;
        }

        return {
            total: pairs.length,
            bySource,
            avgConfidence: pairs.length > 0
                ? pairs.reduce((sum, p) => sum + p.metadata.confidence, 0) / pairs.length
                : 0,
            avgDelta: pairs.length > 0
                ? pairs.reduce((sum, p) => sum + p.metadata.satisfactionDelta, 0) / pairs.length
                : 0,
        };
    }
}
