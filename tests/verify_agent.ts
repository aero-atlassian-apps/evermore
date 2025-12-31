/**
 * Verification Script for Agent Orchestrator
 * 
 * Runs a simulated agent loop with Mock LLM and Tools.
 * Command: npx ts-node tests/verify_agent.ts
 */

import { MockLLM } from '../lib/infrastructure/adapters/mocks/MockLLM';
import { AgentOrchestrator } from '../lib/core/application/agent/orchestration/AgentOrchestrator';
import { Tool, AgentContext } from '../lib/core/application/agent/types';
import { IntentType } from '../lib/core/application/agent/primitives/AgentPrimitives';
import { z } from 'zod';
import { ToolCapability, ToolPermission } from '../lib/core/application/agent/tools/ToolContracts';

async function runVerification() {
    console.log("=== STARTING AGENT VERIFICATION ===");

    // 1. Setup
    const mockLLM = new MockLLM();
    const tools: Tool[] = [{
        metadata: {
            id: 'RetrieveMemoriesTool',
            name: 'Retrieve Memories',
            description: 'Searches memories',
            usageHint: 'mock',
            version: '1.0.0',
            capabilities: [ToolCapability.READ],
            defaultPermission: ToolPermission.ALLOWED,
            estimatedCostCents: 0,
            estimatedLatencyMs: 0,
            enabled: true
        },
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.string(),
        execute: async (input: any) => {
            console.log(`[Tool] RetrieveMemoriesTool called with:`, input);
            return {
                success: true,
                data: "Memory: Best friend is Bob, met in 1990.",
                durationMs: 10
            };
        }
    }];

    const orchestrator = new AgentOrchestrator(mockLLM, tools);

    const context: AgentContext = {
        userId: 'user-123',
        memories: [],
        sessionId: 'session-1',
        recentHistory: []
    };

    // 2. Queue Mock Responses for the "Happy Path"

    // A. Intent Recognition
    mockLLM.queueJson({
        primaryIntent: IntentType.RECALL_MEMORY,
        confidence: 0.95,
        entities: {},
        requiresMemoryLookup: true,
        reasoning: "User is asking about a specific person."
    });

    // B. Planning
    mockLLM.queueJson({
        steps: [{
            id: 'step-1',
            action: 'RetrieveMemoriesTool',
            input: { query: 'best friend' },
            expectedOutputType: 'array'
        }]
    });

    // C. Reflection (after step 1)
    mockLLM.queueJson({
        goalAchieved: true,
        confidence: 0.9,
        summary: "Found memory about Bob.",
        keyFacts: ["Best friend is Bob"],
        outstandingQuestions: [],
        readyForUser: true
    });

    // D. Synthesis
    mockLLM.queueText("Based on your memories, your best friend is Bob, whom you met in 1990.");

    // 3. Run
    console.log("\n--- RUNNING ORCHESTRATOR ---");
    const result = await orchestrator.run("Who is my best friend?", context);

    // 4. Verification
    console.log("\n--- VERIFICATION RESULTS ---");
    console.log("Success:", result.success);
    console.log("Final Answer:", result.finalAnswer);
    console.log("Steps Taken:", result.steps.length);
    console.log("Trace ID:", result.traceId);

    if (result.success && result.finalAnswer.includes("Bob")) {
        console.log("\n✅ VERIFICATION PASSED");
    } else {
        console.error("\n❌ VERIFICATION FAILED");
    }
}

runVerification().catch(console.error);
