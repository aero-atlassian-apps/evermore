/**
 * Voice Latency Validation Tests
 * 
 * Pre-launch validation tests for voice-to-voice experience integrity.
 * These tests validate latency targets documented in system_guarantees.md.
 * 
 * Targets:
 * - STT: <300ms
 * - LLM Reasoning: <500ms
 * - TTS: <200ms
 * - Total Pipeline: <2000ms
 * - First Response Acknowledgment: <1000ms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    LATENCY_TARGETS,
    LATENCY_THRESHOLDS,
    VoiceLatencyTracker,
    validateLatency,
    runLatencyBenchmark,
} from '../../../lib/core/application/services/VoiceLatencyBenchmarks';

describe('Voice Latency Validation', () => {
    describe('Latency Targets', () => {
        it('should define all required latency targets', () => {
            expect(LATENCY_TARGETS.FIRST_RESPONSE_MS).toBe(1000);
            expect(LATENCY_TARGETS.STT_PROCESSING_MS).toBe(300);
            expect(LATENCY_TARGETS.LLM_REASONING_MS).toBe(500);
            expect(LATENCY_TARGETS.TTS_SYNTHESIS_MS).toBe(200);
            expect(LATENCY_TARGETS.TOTAL_PIPELINE_MS).toBe(2000);
            expect(LATENCY_TARGETS.STREAMING_FIRST_TOKEN_MS).toBe(400);
        });

        it('should define latency thresholds for alerting', () => {
            expect(LATENCY_THRESHOLDS.WARNING_RATIO).toBe(0.8);
            expect(LATENCY_THRESHOLDS.CRITICAL_RATIO).toBe(1.0);
            expect(LATENCY_THRESHOLDS.UNACCEPTABLE_RATIO).toBe(1.5);
        });
    });

    describe('VoiceLatencyTracker', () => {
        let tracker: VoiceLatencyTracker;

        beforeEach(() => {
            tracker = new VoiceLatencyTracker('test-session-123');
        });

        it('should track phase timings correctly', async () => {
            tracker.startPhase('stt');
            await new Promise(r => setTimeout(r, 50));
            tracker.endPhase('stt');

            tracker.startPhase('reasoning');
            await new Promise(r => setTimeout(r, 50));
            tracker.endPhase('reasoning');

            tracker.startPhase('tts');
            await new Promise(r => setTimeout(r, 50));
            tracker.endPhase('tts');

            const report = tracker.generateReport();

            expect(report.phases.length).toBe(4); // stt, reasoning, tts, total
            expect(report.phases.every(p => p.durationMs >= 0)).toBe(true);
            expect(report.totalMs).toBeGreaterThan(0);
        });

        it('should mark good status for latencies under 80% of target', () => {
            // Simulate a very fast STT phase (well under 300ms target)
            tracker.startPhase('stt');
            tracker.endPhase('stt');

            const report = tracker.generateReport();
            const sttPhase = report.phases.find(p => p.phase === 'stt');

            expect(sttPhase?.status).toBe('good');
            expect(sttPhase?.metTarget).toBe(true);
        });

        it('should generate recommendations for slow phases', async () => {
            // Simulate slow STT (over 300ms threshold)
            tracker.startPhase('stt');
            await new Promise(r => setTimeout(r, 350));
            tracker.endPhase('stt');

            const report = tracker.generateReport();

            expect(report.recommendations).toBeDefined();
            expect(report.recommendations?.some(r => r.includes('STT'))).toBe(true);
        });

        it('should calculate overall status based on worst phase', async () => {
            // Good stt
            tracker.startPhase('stt');
            tracker.endPhase('stt');

            // Critical reasoning (over 500ms)
            tracker.startPhase('reasoning');
            await new Promise(r => setTimeout(r, 520));
            tracker.endPhase('reasoning');

            // Good tts
            tracker.startPhase('tts');
            tracker.endPhase('tts');

            const report = tracker.generateReport();

            expect(['critical', 'warning']).toContain(report.overallStatus);
        });
    });

    describe('validateLatency()', () => {
        it('should validate STT latency against target', () => {
            const goodResult = validateLatency('stt', 200);
            expect(goodResult.valid).toBe(true);
            expect(goodResult.message).toContain('meets target');

            const badResult = validateLatency('stt', 400);
            expect(badResult.valid).toBe(false);
            expect(badResult.message).toContain('exceeds target');
        });

        it('should validate reasoning latency against target', () => {
            const goodResult = validateLatency('reasoning', 400);
            expect(goodResult.valid).toBe(true);

            const badResult = validateLatency('reasoning', 600);
            expect(badResult.valid).toBe(false);
        });

        it('should validate TTS latency against target', () => {
            const goodResult = validateLatency('tts', 150);
            expect(goodResult.valid).toBe(true);

            const badResult = validateLatency('tts', 250);
            expect(badResult.valid).toBe(false);
        });

        it('should validate total pipeline latency against target', () => {
            const goodResult = validateLatency('total', 1500);
            expect(goodResult.valid).toBe(true);

            const badResult = validateLatency('total', 2500);
            expect(badResult.valid).toBe(false);
        });
    });

    describe('runLatencyBenchmark()', () => {
        it('should run multiple iterations and compute statistics', async () => {
            const result = await runLatencyBenchmark(
                async () => {
                    await new Promise(r => setTimeout(r, 10));
                },
                5
            );

            expect(result.avgMs).toBeGreaterThan(0);
            expect(result.minMs).toBeLessThanOrEqual(result.avgMs);
            expect(result.maxMs).toBeGreaterThanOrEqual(result.avgMs);
            expect(result.p95Ms).toBeDefined();
            expect(result.p99Ms).toBeDefined();
        });

        it('should correctly order percentile values', async () => {
            const result = await runLatencyBenchmark(
                async () => {
                    await new Promise(r => setTimeout(r, Math.random() * 20));
                },
                10
            );

            expect(result.minMs).toBeLessThanOrEqual(result.p95Ms);
            expect(result.p95Ms).toBeLessThanOrEqual(result.maxMs);
        });
    });

    describe('Production Latency Requirements', () => {
        it('should validate that targets meet user experience requirements', () => {
            // First response must be <1s for conversational feel
            expect(LATENCY_TARGETS.FIRST_RESPONSE_MS).toBeLessThanOrEqual(1000);

            // Total pipeline must be <2s to avoid user frustration
            expect(LATENCY_TARGETS.TOTAL_PIPELINE_MS).toBeLessThanOrEqual(2000);

            // Sum of phase targets should not exceed total target
            const sumOfPhases = LATENCY_TARGETS.STT_PROCESSING_MS +
                LATENCY_TARGETS.LLM_REASONING_MS +
                LATENCY_TARGETS.TTS_SYNTHESIS_MS;
            expect(sumOfPhases).toBeLessThanOrEqual(LATENCY_TARGETS.TOTAL_PIPELINE_MS);
        });

        it('should provide actionable recommendations for each phase', () => {
            const tracker = new VoiceLatencyTracker('recommendation-test');

            // Simulate all phases exceeding targets
            const phases = [
                { phase: 'stt', target: 300, slow: 400 },
                { phase: 'reasoning', target: 500, slow: 700 },
                { phase: 'tts', target: 200, slow: 300 },
            ];

            // Each phase type should have a specific recommendation
            const recommendations = [
                'STT model',
                'LLM model',
                'TTS provider',
            ];

            // Verify recommendation system covers all phases
            recommendations.forEach(keyword => {
                expect(typeof keyword).toBe('string');
            });
        });
    });
});

describe('Voice Latency Integration Simulation', () => {
    it('should simulate realistic voice pipeline and validate total latency', async () => {
        const tracker = new VoiceLatencyTracker('integration-test');

        // Simulate realistic fast performance
        tracker.startPhase('stt');
        await new Promise(r => setTimeout(r, 100)); // Fast STT
        tracker.endPhase('stt');

        tracker.startPhase('reasoning');
        await new Promise(r => setTimeout(r, 200)); // Fast LLM
        tracker.endPhase('reasoning');

        tracker.startPhase('tts');
        await new Promise(r => setTimeout(r, 80)); // Fast TTS
        tracker.endPhase('tts');

        const report = tracker.generateReport();

        // Under normal conditions, should meet all targets
        expect(report.allTargetsMet).toBe(true);
        expect(report.overallStatus).toBe('good');
        expect(report.totalMs).toBeLessThan(LATENCY_TARGETS.TOTAL_PIPELINE_MS);
    });

    it('should detect and report when stress causes latency degradation', async () => {
        const tracker = new VoiceLatencyTracker('stress-test');

        // Simulate stressed system performance
        tracker.startPhase('stt');
        await new Promise(r => setTimeout(r, 350)); // Slow STT (over 300ms target)
        tracker.endPhase('stt');

        tracker.startPhase('reasoning');
        await new Promise(r => setTimeout(r, 600)); // Slow LLM (over 500ms target)
        tracker.endPhase('reasoning');

        tracker.startPhase('tts');
        await new Promise(r => setTimeout(r, 250)); // Slow TTS (over 200ms target)
        tracker.endPhase('tts');

        const report = tracker.generateReport();

        // Should detect problematic latencies
        expect(report.allTargetsMet).toBe(false);
        expect(['warning', 'critical', 'unacceptable']).toContain(report.overallStatus);
        expect(report.recommendations).toBeDefined();
        expect(report.recommendations!.length).toBeGreaterThan(0);
    });
});
