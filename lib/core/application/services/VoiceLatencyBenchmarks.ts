/**
 * Voice Latency Benchmarks
 * 
 * Defines latency targets and provides utilities for measuring
 * voice-to-voice response times.
 * 
 * Target: <1s for initial response acknowledgment
 * 
 * @module VoiceLatencyBenchmarks
 */

// ============================================================================
// Latency Targets
// ============================================================================

/**
 * Latency targets in milliseconds.
 * These are production requirements for voice experience integrity.
 */
export const LATENCY_TARGETS = {
    /** Maximum time from user stops speaking to first audio response */
    FIRST_RESPONSE_MS: 1000,

    /** Maximum time for STT processing */
    STT_PROCESSING_MS: 300,

    /** Maximum time for LLM reasoning response */
    LLM_REASONING_MS: 500,

    /** Maximum time for TTS synthesis start */
    TTS_SYNTHESIS_MS: 200,

    /** Maximum acceptable total pipeline latency */
    TOTAL_PIPELINE_MS: 2000,

    /** Target for streaming first token */
    STREAMING_FIRST_TOKEN_MS: 400,
} as const;

/**
 * Latency thresholds for alerting
 */
export const LATENCY_THRESHOLDS = {
    /** Warning threshold (80% of target) */
    WARNING_RATIO: 0.8,

    /** Critical threshold (exceeds target) */
    CRITICAL_RATIO: 1.0,

    /** Unacceptable threshold (150% of target) */
    UNACCEPTABLE_RATIO: 1.5,
} as const;

// ============================================================================
// Latency Measurement
// ============================================================================

/**
 * A single latency measurement
 */
export interface LatencyMeasurement {
    /** Phase of the pipeline */
    phase: 'stt' | 'reasoning' | 'tts' | 'total';
    /** Duration in milliseconds */
    durationMs: number;
    /** Whether it met the target */
    metTarget: boolean;
    /** Status based on thresholds */
    status: 'good' | 'warning' | 'critical' | 'unacceptable';
    /** Timestamp of measurement */
    timestamp: number;
    /** Session ID for correlation */
    sessionId?: string;
}

/**
 * Pipeline latency report
 */
export interface LatencyReport {
    /** Individual phase measurements */
    phases: LatencyMeasurement[];
    /** Total pipeline latency */
    totalMs: number;
    /** Overall status */
    overallStatus: 'good' | 'warning' | 'critical' | 'unacceptable';
    /** Whether all targets were met */
    allTargetsMet: boolean;
    /** Recommendations if targets not met */
    recommendations?: string[];
}

/**
 * Latency tracker for a single voice interaction
 */
export class VoiceLatencyTracker {
    private sessionId: string;
    private startTime: number;
    private phaseTimings: Map<string, { start: number; end?: number }> = new Map();

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.startTime = Date.now();
    }

    /**
     * Mark the start of a phase
     */
    startPhase(phase: 'stt' | 'reasoning' | 'tts'): void {
        this.phaseTimings.set(phase, { start: Date.now() });
    }

    /**
     * Mark the end of a phase
     */
    endPhase(phase: 'stt' | 'reasoning' | 'tts'): void {
        const timing = this.phaseTimings.get(phase);
        if (timing) {
            timing.end = Date.now();
        }
    }

    /**
     * Generate a latency report
     */
    generateReport(): LatencyReport {
        const phases: LatencyMeasurement[] = [];
        const now = Date.now();

        // Measure each phase
        for (const [phase, timing] of this.phaseTimings) {
            const durationMs = (timing.end || now) - timing.start;
            const target = this.getTargetForPhase(phase as 'stt' | 'reasoning' | 'tts');
            const measurement = this.createMeasurement(
                phase as 'stt' | 'reasoning' | 'tts',
                durationMs,
                target
            );
            phases.push(measurement);
        }

        // Calculate total
        const totalMs = now - this.startTime;
        const totalMeasurement = this.createMeasurement('total', totalMs, LATENCY_TARGETS.TOTAL_PIPELINE_MS);
        phases.push(totalMeasurement);

        // Determine overall status
        const statuses = phases.map(p => p.status);
        let overallStatus: 'good' | 'warning' | 'critical' | 'unacceptable' = 'good';
        if (statuses.includes('unacceptable')) overallStatus = 'unacceptable';
        else if (statuses.includes('critical')) overallStatus = 'critical';
        else if (statuses.includes('warning')) overallStatus = 'warning';

        // Generate recommendations
        const recommendations = this.generateRecommendations(phases);

        return {
            phases,
            totalMs,
            overallStatus,
            allTargetsMet: phases.every(p => p.metTarget),
            recommendations: recommendations.length > 0 ? recommendations : undefined,
        };
    }

    private getTargetForPhase(phase: 'stt' | 'reasoning' | 'tts' | 'total'): number {
        switch (phase) {
            case 'stt': return LATENCY_TARGETS.STT_PROCESSING_MS;
            case 'reasoning': return LATENCY_TARGETS.LLM_REASONING_MS;
            case 'tts': return LATENCY_TARGETS.TTS_SYNTHESIS_MS;
            case 'total': return LATENCY_TARGETS.TOTAL_PIPELINE_MS;
        }
    }

    private createMeasurement(
        phase: 'stt' | 'reasoning' | 'tts' | 'total',
        durationMs: number,
        target: number
    ): LatencyMeasurement {
        const ratio = durationMs / target;
        let status: 'good' | 'warning' | 'critical' | 'unacceptable';

        if (ratio >= LATENCY_THRESHOLDS.UNACCEPTABLE_RATIO) status = 'unacceptable';
        else if (ratio >= LATENCY_THRESHOLDS.CRITICAL_RATIO) status = 'critical';
        else if (ratio >= LATENCY_THRESHOLDS.WARNING_RATIO) status = 'warning';
        else status = 'good';

        return {
            phase,
            durationMs,
            metTarget: ratio < LATENCY_THRESHOLDS.CRITICAL_RATIO,
            status,
            timestamp: Date.now(),
            sessionId: this.sessionId,
        };
    }

    private generateRecommendations(phases: LatencyMeasurement[]): string[] {
        const recommendations: string[] = [];

        for (const phase of phases) {
            if (phase.status === 'critical' || phase.status === 'unacceptable') {
                switch (phase.phase) {
                    case 'stt':
                        recommendations.push('Consider using a faster STT model or reducing audio chunk size');
                        break;
                    case 'reasoning':
                        recommendations.push('Consider using a smaller/faster LLM model or enabling streaming');
                        break;
                    case 'tts':
                        recommendations.push('Consider pre-generating common responses or using a faster TTS provider');
                        break;
                    case 'total':
                        recommendations.push('Total latency exceeds target - review all pipeline phases');
                        break;
                }
            }
        }

        return recommendations;
    }
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

/**
 * Run a benchmark test for voice latency
 */
export async function runLatencyBenchmark(
    testFn: () => Promise<void>,
    iterations: number = 10
): Promise<{
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
    p99Ms: number;
}> {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await testFn();
        durations.push(Date.now() - start);
    }

    durations.sort((a, b) => a - b);

    return {
        avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        minMs: durations[0],
        maxMs: durations[durations.length - 1],
        p95Ms: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
        p99Ms: durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1],
    };
}

/**
 * Validate that latency meets production requirements
 */
export function validateLatency(
    phase: 'stt' | 'reasoning' | 'tts' | 'total',
    durationMs: number
): { valid: boolean; message: string } {
    const tracker = new VoiceLatencyTracker('validation');
    const target = phase === 'stt' ? LATENCY_TARGETS.STT_PROCESSING_MS
        : phase === 'reasoning' ? LATENCY_TARGETS.LLM_REASONING_MS
            : phase === 'tts' ? LATENCY_TARGETS.TTS_SYNTHESIS_MS
                : LATENCY_TARGETS.TOTAL_PIPELINE_MS;

    const ratio = durationMs / target;
    const valid = ratio < LATENCY_THRESHOLDS.CRITICAL_RATIO;

    return {
        valid,
        message: valid
            ? `✅ ${phase} latency ${durationMs}ms meets target of ${target}ms`
            : `❌ ${phase} latency ${durationMs}ms exceeds target of ${target}ms`
    };
}
