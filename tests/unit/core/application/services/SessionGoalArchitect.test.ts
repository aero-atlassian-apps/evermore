import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionGoalArchitect, SessionContext } from '@/lib/core/application/services/SessionGoalArchitect';
import { LLMPort } from '@/lib/core/application/ports/LLMPort';
import { VoiceAgentPort } from '@/lib/core/application/ports/VoiceAgentPort';

describe('SessionGoalArchitect (Chain of Thought)', () => {
    let architect: SessionGoalArchitect;
    let mockLLM: LLMPort;
    let mockVoiceAgent: VoiceAgentPort;

    beforeEach(() => {
        mockLLM = {
            generateText: vi.fn(),
            generateJson: vi.fn(),
            analyzeImage: vi.fn()
        };
        mockVoiceAgent = {
            startConversation: vi.fn()
        };

        architect = new SessionGoalArchitect(mockLLM, mockVoiceAgent);
    });

    it('should use Chain of Thought to determine goal', async () => {
        vi.spyOn(mockLLM, 'generateJson').mockResolvedValue({
            contextSummary: "User loves music.",
            safetyRisks: [],
            potentialStrategies: ["Ask about favorite band", "Ask about first concert"],
            selectedStrategy: "Ask about first concert",
            finalGoal: "Ask about their first concert experience."
        });

        const context: SessionContext = {
            userId: 'u1',
            sessionId: 's1',
            userName: 'John',
            memories: [],
            topicsAvoid: ['politics'],
            topicsLove: ['music']
        };

        await architect.determineSessionGoal(context);

        expect(mockLLM.generateJson).toHaveBeenCalled();
        const callArgs = (mockLLM.generateJson as any).mock.calls[0][0];
        expect(callArgs).toContain('Chain of Thought');
        expect(callArgs).toContain('Topics to Avoid: politics');

        expect(mockVoiceAgent.startConversation).toHaveBeenCalledWith(
            'u1', 's1', 'John',
            expect.objectContaining({ goal: "Ask about their first concert experience." })
        );
    });

    it('should fallback to basic prompt if CoT fails', async () => {
        vi.spyOn(mockLLM, 'generateJson').mockRejectedValue(new Error("CoT Failed"));
        vi.spyOn(mockLLM, 'generateText').mockResolvedValue("Fallback Goal");

        const context: SessionContext = {
            userId: 'u1',
            sessionId: 's1',
            userName: 'John',
            memories: [],
            topicsAvoid: [],
            topicsLove: []
        };

        await architect.determineSessionGoal(context);

        expect(mockLLM.generateText).toHaveBeenCalled();
        expect(mockVoiceAgent.startConversation).toHaveBeenCalledWith(
            'u1', 's1', 'John',
            expect.objectContaining({ goal: "Fallback Goal" })
        );
    });
});
