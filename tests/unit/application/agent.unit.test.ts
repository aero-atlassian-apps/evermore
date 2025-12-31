/**
 * Agent Core Unit Tests
 * 
 * Tests for the core agent primitives:
 * - IntentRecognizer
 * - StepExecutor
 * - ObservationReflector
 * - AnswerSynthesizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentRecognizer } from '../../../lib/core/application/agent/recognition/IntentRecognizer';
import { StepExecutor } from '../../../lib/core/application/agent/execution/StepExecutor';
import { ObservationReflector } from '../../../lib/core/application/agent/reflection/ObservationReflector';
import { AnswerSynthesizer } from '../../../lib/core/application/agent/execution/AnswerSynthesizer';
import { IntentType, PlannedStep, ProcessedObservation, ReflectionResult, ExecutionContext, ObservationType } from '../../../lib/core/application/agent/primitives/AgentPrimitives';
import { AgentContext, Tool } from '../../../lib/core/application/agent/types';
import { LLMPort } from '../../../lib/core/application/ports/LLMPort';
import { z } from 'zod';

// ============================================================================
// Mock LLM
// ============================================================================

class TestMockLLM implements LLMPort {
    private jsonQueue: unknown[] = [];
    private textQueue: string[] = [];

    queueJson(response: unknown) {
        this.jsonQueue.push(response);
    }

    queueText(response: string) {
        this.textQueue.push(response);
    }

    async generateText(_prompt: string): Promise<string> {
        if (this.textQueue.length > 0) {
            return this.textQueue.shift()!;
        }
        return "Default mock text response";
    }

    async generateJson<T>(_prompt: string): Promise<T> {
        if (this.jsonQueue.length > 0) {
            return this.jsonQueue.shift() as T;
        }
        throw new Error("No JSON response queued");
    }

    async analyzeImage(_imageBase64: string, _mimeType: string, _prompt: string): Promise<string> {
        return "Mock image analysis";
    }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestContext = (): AgentContext => ({
    userId: 'test-user-123',
    sessionId: 'test-session-456',
    memories: [],
    recentHistory: []
});

const createMockTool = (name: string, returnValue: unknown): Tool => ({
    metadata: {
        id: name,
        name,
        description: `Mock ${name} tool`,
        usageHint: 'mock hint',
        version: '1.0.0',
        capabilities: [],
        defaultPermission: 'ALLOWED' as any,
        estimatedCostCents: 0,
        estimatedLatencyMs: 0,
        enabled: true
    },
    inputSchema: z.any() as any,
    outputSchema: z.any() as any,
    execute: vi.fn().mockResolvedValue({
        success: true,
        data: returnValue,
        durationMs: 0
    })
});

const createExecutionContext = (): ExecutionContext => ({
    agentContext: createTestContext(),
    previousResults: [],
    observations: [],
    tokenCount: 0,
    costCents: 0
});

// ============================================================================
// IntentRecognizer Tests
// ============================================================================

describe('IntentRecognizer', () => {
    let mockLLM: TestMockLLM;
    let recognizer: IntentRecognizer;
    let context: AgentContext;

    beforeEach(() => {
        mockLLM = new TestMockLLM();
        recognizer = new IntentRecognizer(mockLLM);
        context = createTestContext();
    });

    describe('recognize()', () => {
        it('should correctly classify SHARE_MEMORY intent', async () => {
            mockLLM.queueJson({
                primaryIntent: IntentType.SHARE_MEMORY,
                confidence: 0.92,
                entities: { topic: 'childhood' },
                requiresMemoryLookup: false,
                requiresSafetyCheck: false,
                reasoning: 'User is sharing a personal story'
            });

            const result = await recognizer.recognize(
                "Let me tell you about my childhood in the country",
                context
            );

            expect(result.primaryIntent).toBe(IntentType.SHARE_MEMORY);
            expect(result.confidence).toBeGreaterThan(0.9);
            expect(result.requiresMemoryLookup).toBe(false);
        });

        it('should correctly classify RECALL_MEMORY intent', async () => {
            mockLLM.queueJson({
                primaryIntent: IntentType.RECALL_MEMORY,
                confidence: 0.88,
                entities: { subject: 'friend' },
                requiresMemoryLookup: true,
                requiresSafetyCheck: false,
                reasoning: 'User is asking about a past memory'
            });

            const result = await recognizer.recognize(
                "Who was my best friend you mentioned earlier?",
                context
            );

            expect(result.primaryIntent).toBe(IntentType.RECALL_MEMORY);
            expect(result.requiresMemoryLookup).toBe(true);
        });

        it('should return UNKNOWN for invalid intents from LLM', async () => {
            mockLLM.queueJson({
                primaryIntent: 'INVALID_INTENT_TYPE',
                confidence: 0.5,
                entities: {},
                requiresMemoryLookup: false,
                requiresSafetyCheck: false
            });

            const result = await recognizer.recognize("random input", context);

            expect(result.primaryIntent).toBe(IntentType.UNKNOWN);
            expect(result.confidence).toBe(0);
        });

        it('should gracefully handle LLM errors', async () => {
            // No response queued - will throw
            const result = await recognizer.recognize("test input", context);

            expect(result.primaryIntent).toBe(IntentType.UNKNOWN);
            expect(result.confidence).toBe(0);
            expect(result.reasoning).toContain('Failed');
        });

        it('should detect safety check requirements', async () => {
            mockLLM.queueJson({
                primaryIntent: IntentType.SHARE_EMOTION,
                confidence: 0.95,
                entities: { emotion: 'sadness' },
                requiresMemoryLookup: false,
                requiresSafetyCheck: true,
                reasoning: 'User expressing difficult emotions'
            });

            const result = await recognizer.recognize(
                "I've been feeling very sad lately",
                context
            );

            expect(result.primaryIntent).toBe(IntentType.SHARE_EMOTION);
            expect(result.requiresSafetyCheck).toBe(true);
        });
    });
});

// ============================================================================
// StepExecutor Tests
// ============================================================================

describe('StepExecutor', () => {
    let mockLLM: TestMockLLM;
    let executor: StepExecutor;
    let mockTools: Tool[];

    beforeEach(() => {
        mockLLM = new TestMockLLM();
        mockTools = [
            createMockTool('RetrieveMemories', [{ text: 'Memory about Bob' }]),
            createMockTool('CheckSafety', { riskLevel: 'LOW' })
        ];
        executor = new StepExecutor(mockLLM, mockTools);
    });

    describe('execute()', () => {
        it('should execute a tool and return success result', async () => {
            const step: PlannedStep = {
                id: 'step-1',
                order: 1,
                action: 'RetrieveMemories',
                tool: 'RetrieveMemories',
                input: { query: 'best friend' },
                expectedOutputType: 'array',
                maxRetries: 2,
                timeoutMs: 5000,
                onFailure: 'retry'
            };

            const result = await executor.execute(step, createExecutionContext());

            expect(result.success).toBe(true);
            expect(result.stepId).toBe('step-1');
            expect(result.output).toEqual([{ text: 'Memory about Bob' }]);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should return error when tool not found', async () => {
            const step: PlannedStep = {
                id: 'step-2',
                order: 1,
                action: 'NonExistentTool',
                input: {},
                expectedOutputType: 'string',
                maxRetries: 1,
                timeoutMs: 5000,
                onFailure: 'abort'
            };

            const result = await executor.execute(step, createExecutionContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('NonExistentTool');
            expect(result.error).toContain('not found');
        });

        it('should handle tool execution errors', async () => {
            const failingTool: Tool = {
                metadata: {
                    id: 'FailingTool',
                    name: 'FailingTool',
                    description: 'A tool that fails',
                    usageHint: 'mock hint',
                    version: '1.0.0',
                    capabilities: [],
                    defaultPermission: 'ALLOWED' as any,
                    estimatedCostCents: 0,
                    estimatedLatencyMs: 0,
                    enabled: true
                },
                inputSchema: z.any() as any,
                outputSchema: z.any() as any,
                execute: vi.fn().mockRejectedValue(new Error('Tool crashed'))
            };

            const executorWithFailingTool = new StepExecutor(mockLLM, [failingTool]);

            const step: PlannedStep = {
                id: 'step-3',
                order: 1,
                action: 'FailingTool',
                tool: 'FailingTool',
                input: {},
                expectedOutputType: 'any',
                maxRetries: 1,
                timeoutMs: 5000,
                onFailure: 'abort'
            };

            const result = await executorWithFailingTool.execute(step, createExecutionContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Tool crashed');
        });

        it('should handle Final Answer action specially', async () => {
            const step: PlannedStep = {
                id: 'step-final',
                order: 1,
                action: 'Final Answer',
                input: { text: 'Your best friend is Bob.' },
                expectedOutputType: 'string',
                maxRetries: 0,
                timeoutMs: 5000,
                onFailure: 'abort'
            };

            const result = await executor.execute(step, createExecutionContext());

            expect(result.success).toBe(true);
            expect(result.output).toEqual({ text: 'Your best friend is Bob.' });
        });

        it('should track execution duration', async () => {
            const slowTool: Tool = {
                metadata: {
                    id: 'SlowTool',
                    name: 'SlowTool',
                    description: 'Slow tool',
                    usageHint: 'mock hint',
                    version: '1.0.0',
                    capabilities: [],
                    defaultPermission: 'ALLOWED' as any,
                    estimatedCostCents: 0,
                    estimatedLatencyMs: 0,
                    enabled: true
                },
                inputSchema: z.any() as any,
                outputSchema: z.any() as any,
                execute: vi.fn().mockImplementation(() =>
                    new Promise(resolve => setTimeout(() => resolve({
                        success: true,
                        data: 'done',
                        durationMs: 50
                    }), 50))
                )
            };

            const executorWithSlowTool = new StepExecutor(mockLLM, [slowTool]);

            const step: PlannedStep = {
                id: 'step-slow',
                order: 1,
                action: 'SlowTool',
                tool: 'SlowTool',
                input: {},
                expectedOutputType: 'string',
                maxRetries: 1,
                timeoutMs: 5000,
                onFailure: 'abort'
            };

            const result = await executorWithSlowTool.execute(step, createExecutionContext());

            expect(result.success).toBe(true);
            expect(result.durationMs).toBeGreaterThanOrEqual(50);
        });
    });
});

// ============================================================================
// ObservationReflector Tests
// ============================================================================

describe('ObservationReflector', () => {
    let mockLLM: TestMockLLM;
    let reflector: ObservationReflector;

    beforeEach(() => {
        mockLLM = new TestMockLLM();
        reflector = new ObservationReflector(mockLLM);
    });

    describe('validate()', () => {
        it('should return not achieved when no observations', async () => {
            const result = await reflector.validate([], "Find my friend's name");

            expect(result.goalAchieved).toBe(false);
            expect(result.confidence).toBe(0);
            expect(result.readyForUser).toBe(false);
        });

        it('should correctly reflect on successful observations', async () => {
            mockLLM.queueJson({
                goalAchieved: true,
                confidence: 0.95,
                summary: 'Found the user\'s best friend is Bob',
                keyFacts: ['Best friend is Bob', 'Met in 1990'],
                outstandingQuestions: [],
                qualityScore: 0.9,
                readyForUser: true
            });

            const observations: ProcessedObservation[] = [
                {
                    stepId: 'step-1',
                    type: ObservationType.INFORMATION,
                    rawData: { memories: [{ text: 'Bob is best friend' }] },
                    insight: 'User\'s best friend is Bob',
                    confidence: 0.9,
                    invalidatesPlan: false
                }
            ];

            const result = await reflector.validate(
                observations,
                "Who is my best friend?"
            );

            expect(result.goalAchieved).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.9);
            expect(result.keyFacts).toContain('Best friend is Bob');
            expect(result.readyForUser).toBe(true);
        });

        it('should identify incomplete goals', async () => {
            mockLLM.queueJson({
                goalAchieved: false,
                confidence: 0.6,
                summary: 'Found partial information about Paris trip',
                keyFacts: ['User went to Paris'],
                outstandingQuestions: ['When was the trip?', 'Who went with them?'],
                qualityScore: 0.5,
                readyForUser: false
            });

            const observations: ProcessedObservation[] = [
                {
                    stepId: 'step-1',
                    type: ObservationType.INSUFFICIENT,
                    rawData: { partial: true },
                    insight: 'Paris trip exists but details missing',
                    confidence: 0.6,
                    invalidatesPlan: false
                }
            ];

            const result = await reflector.validate(
                observations,
                "Tell me about my Paris trip with all the details"
            );

            expect(result.goalAchieved).toBe(false);
            expect(result.outstandingQuestions.length).toBeGreaterThan(0);
            expect(result.readyForUser).toBe(false);
        });

        it('should handle LLM errors gracefully', async () => {
            // No response queued - will throw
            const observations: ProcessedObservation[] = [
                {
                    stepId: 'step-analysis',
                    type: ObservationType.INFORMATION,
                    rawData: {},
                    insight: 'Some analysis',
                    confidence: 0.8,
                    invalidatesPlan: false
                }
            ];

            const result = await reflector.validate(observations, "test goal");

            expect(result.goalAchieved).toBe(false);
            expect(result.summary).toContain('Error');
        });
    });
});

// ============================================================================
// AnswerSynthesizer Tests
// ============================================================================

describe('AnswerSynthesizer', () => {
    let mockLLM: TestMockLLM;
    let synthesizer: AnswerSynthesizer;
    let context: AgentContext;

    beforeEach(() => {
        mockLLM = new TestMockLLM();
        synthesizer = new AnswerSynthesizer(mockLLM);
        context = createTestContext();
    });

    describe('synthesize()', () => {
        it('should generate empathetic response for seniors', async () => {
            mockLLM.queueText(
                "Based on what you've shared, your best friend is Bob, " +
                "whom you met back in 1990. That's a wonderful long-lasting friendship!"
            );

            const reflection: ReflectionResult = {
                goalAchieved: true,
                confidence: 0.95,
                summary: 'Best friend is Bob, met in 1990',
                keyFacts: ['Best friend is Bob', 'Met in 1990'],
                outstandingQuestions: [],
                qualityScore: 0.9,
                readyForUser: true
            };

            const result = await synthesizer.synthesize(reflection, context);

            expect(result).toContain('Bob');
            expect(result).toContain('friend');
        });

        it('should handle failed goals gracefully', async () => {
            mockLLM.queueText(
                "I'm sorry, I couldn't find information about that specific trip. " +
                "Could you tell me more about when it might have happened?"
            );

            const reflection: ReflectionResult = {
                goalAchieved: false,
                confidence: 0.3,
                summary: 'Could not find the Paris trip',
                keyFacts: [],
                outstandingQuestions: ['When was the trip?'],
                qualityScore: 0.2,
                readyForUser: true
            };

            const result = await synthesizer.synthesize(reflection, context);

            expect(result).toContain("sorry");
        });

        it('should use custom tone configuration', async () => {
            mockLLM.queueText("Here are the facts: Bob is your friend. You met in 1990.");

            const reflection: ReflectionResult = {
                goalAchieved: true,
                confidence: 0.9,
                summary: 'Facts found',
                keyFacts: ['Bob is friend', '1990'],
                outstandingQuestions: [],
                qualityScore: 0.9,
                readyForUser: true
            };

            const result = await synthesizer.synthesize(reflection, context, {
                audience: 'family',
                tone: 'informative',
                includeCitations: true
            });

            expect(result).toBeTruthy();
        });

        it('should return a valid response even with default mock', async () => {
            // No response queued - mock returns default text
            const reflection: ReflectionResult = {
                goalAchieved: true,
                confidence: 0.9,
                summary: 'Important summary here',
                keyFacts: [],
                outstandingQuestions: [],
                qualityScore: 0.9,
                readyForUser: true
            };

            const result = await synthesizer.synthesize(reflection, context);

            // Should return some response (default or synthesized)
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });
    });
});
