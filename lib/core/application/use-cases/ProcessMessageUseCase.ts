import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { LLMPort } from '../ports/LLMPort';
import { VectorStorePort } from '../ports/VectorStorePort';
import { ContentSafetyGuard } from '../services/ContentSafetyGuard';
import { EnhancedReActAgent } from '../agent/EnhancedReActAgent';
import { CONVERSATIONAL_AGENT_SYSTEM_PROMPT } from '../agent/prompts/SystemPrompts';
import { RetrieveMemoriesTool } from '../agent/tools/RetrieveMemoriesTool';
import { CheckSafetyTool } from '../agent/tools/CheckSafetyTool';
import { ToolRegistry, ToolCapability, ToolPermission } from '../agent/tools/ToolContracts';
import { ModelRouter, ModelTier, TaskComplexity, ModelProfile, DEFAULT_MODELS } from '../agent/routing/ModelRouter';
import { HallucinationDetector, GroundTruthSource } from '../safety/HallucinationDetector';
import { validateEmail } from '../security/InputSanitization';
import { logger } from '../Logger';
import { AgentMemoryPort } from '../ports/AgentMemoryPort';
import { z } from 'zod';
import { Message } from '../../domain/value-objects/Message';

export class ProcessMessageUseCase {
  private hallucinationDetector: HallucinationDetector;

  constructor(
    private sessionRepository: SessionRepository,
    private userRepository: UserRepository,
    private llm: LLMPort,
    private vectorStore: VectorStorePort,
    private contentSafetyGuard: ContentSafetyGuard,
    private memoryFactory: (userId: string) => AgentMemoryPort
  ) {
    // Initialize HallucinationDetector for response validation
    this.hallucinationDetector = new HallucinationDetector(llm, {
      flagThreshold: 0.7,
      maxSourcesToCheck: 5,
      suggestCorrections: true,
      defaultCheckTypes: ['FACT_GROUNDING', 'ENTITY_EXISTENCE'],
    });
  }

  async execute(
    sessionId: string,
    message: string,
    speaker: 'user' | 'agent'
  ): Promise<any> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Standardize transcript parsing
    let transcript: Message[] = [];
    const raw = session.transcriptRaw;
    if (Array.isArray(raw)) {
      transcript = raw;
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        transcript = JSON.parse(raw);
      } catch (e) {
        logger.error('[ProcessMessageUseCase] Failed to parse transcript string', { sessionId, error: e });
        transcript = [];
      }
    }

    // Handle conversation initialization signal
    if (message === '__init__' && speaker === 'user') {
      // Don't add __init__ to transcript - just return greeting
      const user = await this.userRepository.findById(session.userId);
      const userName = user?.name || 'there';
      const greeting = `Hello${userName !== 'there' ? `, ${userName.split(' ')[0]}` : ''}! I'm Evermore, your story companion. What story would you like to share with me today?`;

      // Add the greeting to transcript
      transcript.push({
        id: `msg-${Date.now()}`,
        speaker: 'agent',
        text: greeting,
        timestamp: new Date().toISOString(),
      });
      session.transcriptRaw = transcript;
      await this.sessionRepository.update(session);

      return { text: greeting, strategy: 'greeting' };
    }

    // HARDENING: Transcript Atomicity
    // We build the user message but DON'T save it immediately.
    // Both user message and agent response will be saved atomically after agent completes.
    // This prevents orphaned user messages if agent fails mid-execution.
    const pendingUserMessage = {
      id: `msg-${Date.now()}`,
      speaker,
      text: message,
      timestamp: new Date().toISOString(),
    };
    // Note: We add to local transcript for context but don't persist yet
    transcript.push(pendingUserMessage);

    if (speaker === 'user') {
      const user = await this.userRepository.findById(session.userId);

      // HARDENING: Validate emergency contact email before use
      let emergencyContact: string | undefined;
      const rawEmergencyEmail = user?.preferences?.emergencyContact?.email;
      if (rawEmergencyEmail) {
        const emailValidation = validateEmail(rawEmergencyEmail);
        if (emailValidation.valid) {
          emergencyContact = rawEmergencyEmail;
        } else {
          logger.warn('[ProcessMessageUseCase] Invalid emergency contact email format, safety alerts will not be sent:', { error: emailValidation.error });
        }
      }

      // Fast check
      const isRisky = await this.contentSafetyGuard.monitor(
        message, session.userId, sessionId, emergencyContact
      );
      if (isRisky) {
        return { text: "I'm concerned about what you just said. I've notified someone who can help.", strategy: "safety_intervention" };
      }

      // 1. Initialize Tool Registry with proper contracts
      const toolRegistry = new ToolRegistry();

      const memoriesTool = new RetrieveMemoriesTool(this.memoryFactory);
      const safetyTool = new CheckSafetyTool(this.contentSafetyGuard, emergencyContact);

      // Register tools
      toolRegistry.register(memoriesTool);
      toolRegistry.register(safetyTool);

      // 2. Initialize Model Router (Use centralized defaults from ModelRouter.ts)
      const modelRouter = new ModelRouter(DEFAULT_MODELS);

      const context = {
        userId: session.userId,
        sessionId: sessionId,
        memories: [],
        recentHistory: transcript.slice(-10)
      };

      // 3. Instantiate Enhanced Agent with registered tools
      const agent = new EnhancedReActAgent(
        this.llm,
        modelRouter,
        [memoriesTool, safetyTool], // Tools array for descriptions
        {
          userId: session.userId,
          modelProfile: ModelProfile.BALANCED,
          maxSteps: 5,
          costBudgetCents: 50
        },
        this.vectorStore,
        undefined,
        undefined,
        toolRegistry // Now properly populated with registered tools
      );

      const result = await agent.run(`User said: "${message}". Respond appropriately.`, context);

      // Only respond if agent generated a meaningful response
      // Don't interrupt storytelling with useless filler messages
      if (!result.success || !result.finalAnswer || result.finalAnswer.trim().length < 10) {
        // HARDENING: Even for silent listen, save the user message (no agent response)
        session.transcriptRaw = transcript;
        await this.sessionRepository.update(session);
        return { text: '', strategy: 'silent_listen' };
      }

      let responseText = result.finalAnswer;

      // 4. HALLUCINATION DETECTION: Validate response against conversation context
      let hallucinationWarning: string | undefined;
      try {
        // Build ground truth from recent conversation
        const groundTruth: GroundTruthSource[] = transcript.slice(-5).map((msg: any, idx: number) => ({
          id: `msg-${idx}`,
          type: 'transcript' as const,
          content: `${msg.speaker}: ${msg.text}`,
          confidence: 1.0,
          timestamp: msg.timestamp,
        }));

        // Only check if we have context and a substantial response
        if (groundTruth.length > 0 && responseText.length > 50) {
          const hallucinationResult = await this.hallucinationDetector.check({
            text: responseText,
            groundTruth,
            checkType: 'FACT_GROUNDING',
            context: `This is a conversational response to: "${message}"`,
          });

          if (hallucinationResult.isLikelyHallucination && hallucinationResult.confidence > 0.7) {
            logger.warn('[ProcessMessageUseCase] Hallucination detected:', { summary: hallucinationResult.summary });
            hallucinationWarning = hallucinationResult.summary;

            // If corrections are suggested, use the first one
            if (hallucinationResult.suggestedCorrections && hallucinationResult.suggestedCorrections.length > 0) {
              // Don't replace the response, but note it for transparency
              logger.info('[ProcessMessageUseCase] Suggested correction available');
            }

            // Append a soft disclaimer for high-confidence hallucinations
            if (hallucinationResult.confidence > 0.85) {
              responseText += "\n\n_(I want to be transparent: I may have made some assumptions. Please let me know if anything doesn't sound right.)_";
            }
          }
        }
      } catch (hallucinationError) {
        // Don't fail the response if hallucination check fails
        logger.warn('[ProcessMessageUseCase] Hallucination check failed:', { error: hallucinationError });
      }

      // HARDENING: Atomic save - Both user message and agent response saved together
      // The pending user message was already added to local transcript array above
      // Now we add the agent response and save everything in one operation
      transcript.push({
        id: `msg-${Date.now() + 1}`,
        speaker: 'agent',
        text: responseText,
        timestamp: new Date().toISOString(),
        strategy: 'agentic',
        metadata: {
          traceId: sessionId,
          reasoning: result.steps.map(s => s.thought).join(' -> '),
          cost: result.totalCostCents,
          hallucinationWarning, // Track if hallucination was detected
        }
      });

      session.transcriptRaw = transcript;
      await this.sessionRepository.update(session);

      return { text: responseText, strategy: 'agentic', hallucinationWarning };
    }

    return null;
  }
}
