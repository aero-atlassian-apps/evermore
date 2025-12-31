/**
 * StreamingProcessMessageUseCase - Real-time agentic conversation with event streaming
 * 
 * This use case wraps the ProcessMessageUseCase to add real-time state transitions
 * and token streaming capabilities. Designed for SSE consumption.
 * 
 * Agent States Streamed:
 * - listening: Received user input
 * - understanding: Parsing intent
 * - recalling: Retrieving memories
 * - thinking: Agent reasoning
 * - responding: Generating response
 * - complete: Done
 */

import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { LLMPort } from '../ports/LLMPort';
import { VectorStorePort } from '../ports/VectorStorePort';
import { ContentSafetyGuard } from '../services/ContentSafetyGuard';
import { EnhancedReActAgent } from '../agent/EnhancedReActAgent';
import { RetrieveMemoriesTool } from '../agent/tools/RetrieveMemoriesTool';
import { CheckSafetyTool } from '../agent/tools/CheckSafetyTool';
import { ToolRegistry, ToolCapability, ToolPermission } from '../agent/tools/ToolContracts';
import { ModelRouter, ModelProfile, DEFAULT_MODELS } from '../agent/routing/ModelRouter';
import { logger } from '../Logger';
import { z } from 'zod';
import { AgentMemoryPort } from '../ports/AgentMemoryPort';
import { Message } from '../../domain/value-objects/Message';

export interface StreamingCallbacks {
    onStateChange: (state: string, details?: string) => void;
    onToken: (token: string) => void;
    onComplete: (response: { text: string; strategy: string }) => void;
    onError: (error: string) => void;
}

export class StreamingProcessMessageUseCase {
    constructor(
        private sessionRepository: SessionRepository,
        private userRepository: UserRepository,
        private llm: LLMPort,
        private vectorStore: VectorStorePort,
        private contentSafetyGuard: ContentSafetyGuard,
        private memoryFactory: (userId: string) => AgentMemoryPort
    ) { }

    async executeStreaming(
        sessionId: string,
        message: string,
        speaker: 'user' | 'agent',
        callbacks: StreamingCallbacks
    ): Promise<void> {
        try {
            // State: Listening
            callbacks.onStateChange('listening', 'Received your message');
            logger.info('[StreamingProcessMessage] Starting streaming message processing', { sessionId, messagePreview: message.substring(0, 30) });

            const session = await this.sessionRepository.findById(sessionId);
            if (!session) {
                callbacks.onError('Session not found');
                return;
            }

            // Standardize transcript parsing
            let transcript: Message[] = [];
            const raw = session.transcriptRaw;
            if (Array.isArray(raw)) {
                transcript = raw;
            } else if (typeof raw === 'string' && raw.trim().length > 0) {
                try {
                    transcript = JSON.parse(raw);
                } catch (e) {
                    logger.error('[StreamingProcessMessage] Failed to parse transcript string', { sessionId, error: e });
                    transcript = [];
                }
            }
            logger.info('[StreamingProcessMessage] Parsed transcript', { sessionId, transcriptLength: transcript.length });

            // Handle conversation initialization
            if (message === '__init__' && speaker === 'user') {
                callbacks.onStateChange('responding', 'Preparing greeting');
                const user = await this.userRepository.findById(session.userId);
                const userName = user?.name || 'there';
                const greeting = `Hello${userName !== 'there' ? `, ${userName.split(' ')[0]}` : ''}! I'm Evermore, your story companion. What story would you like to share with me today?`;

                // Stream the greeting tokens for effect
                for (const word of greeting.split(' ')) {
                    callbacks.onToken(word + ' ');
                    await this.delay(30); // Natural typing feel
                }

                // Save to transcript
                transcript.push({
                    id: `msg-${Date.now()}`,
                    speaker: 'agent',
                    text: greeting,
                    timestamp: new Date().toISOString(),
                });
                session.transcriptRaw = transcript; // Store as array, DB handles JSON
                await this.sessionRepository.update(session);

                callbacks.onComplete({ text: greeting, strategy: 'greeting' });
                return;
            }

            // State: Understanding
            callbacks.onStateChange('understanding', 'Processing your words');

            // Save user message
            transcript.push({
                id: `msg-${Date.now()}`,
                speaker,
                text: message,
                timestamp: new Date().toISOString(),
            });
            session.transcriptRaw = transcript;
            logger.info('[StreamingProcessMessage] Saving user message to session', {
                sessionId,
                messagePreview: message.substring(0, 50),
                transcriptLength: transcript.length,
            });
            await this.sessionRepository.update(session);

            if (speaker !== 'user') {
                callbacks.onComplete({ text: '', strategy: 'echo' });
                return;
            }

            // Safety check
            const user = await this.userRepository.findById(session.userId);
            const emergencyContact = user?.preferences?.emergencyContact?.email;

            callbacks.onStateChange('checking', 'Ensuring safety');
            const isRisky = await this.contentSafetyGuard.monitor(
                message, session.userId, sessionId, emergencyContact
            );
            if (isRisky) {
                const safetyResponse = "I'm concerned about what you just said. I've notified someone who can help.";
                callbacks.onToken(safetyResponse);
                callbacks.onComplete({ text: safetyResponse, strategy: 'safety_intervention' });
                return;
            }

            // State: Recalling
            callbacks.onStateChange('recalling', 'Connecting to your stories');

            // Set up tools
            const toolRegistry = new ToolRegistry();
            const memoriesTool = new RetrieveMemoriesTool(this.memoryFactory);
            const safetyTool = new CheckSafetyTool(this.contentSafetyGuard, emergencyContact);

            toolRegistry.register(memoriesTool);
            toolRegistry.register(safetyTool);

            // State: Thinking
            callbacks.onStateChange('thinking', 'Considering response');

            const modelRouter = new ModelRouter(DEFAULT_MODELS);
            const context = {
                userId: session.userId,
                sessionId: sessionId,
                memories: [],
                recentHistory: transcript.slice(-10)
            };

            const agent = new EnhancedReActAgent(
                this.llm,
                modelRouter,
                [memoriesTool, safetyTool],
                {
                    userId: session.userId,
                    modelProfile: ModelProfile.BALANCED,
                    maxSteps: 5,
                    costBudgetCents: 50
                },
                this.vectorStore,
                undefined,
                undefined,
                toolRegistry
            );

            // State: Reasoning
            callbacks.onStateChange('reasoning', 'Processing thoughts');

            const result = await agent.run(`User said: "${message}". Respond appropriately.`, context);

            // Only respond if agent generated a meaningful response
            // Don't interrupt storytelling with useless filler messages
            if (!result.success || !result.finalAnswer || result.finalAnswer.trim().length < 10) {
                // Silent acknowledgment - transcript is saved, but no interruption
                callbacks.onComplete({ text: '', strategy: 'silent_listen' });
                return;
            }

            const responseText = result.finalAnswer;

            // State: Responding - Stream the response
            callbacks.onStateChange('responding', 'Sharing thoughts');

            // Stream response word by word for natural feel
            const words = responseText.split(' ');
            for (let i = 0; i < words.length; i++) {
                callbacks.onToken(words[i] + (i < words.length - 1 ? ' ' : ''));
                await this.delay(25); // Adjust for natural pacing
            }

            // Save agent response
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
                }
            });
            session.transcriptRaw = transcript;
            await this.sessionRepository.update(session);

            callbacks.onComplete({ text: responseText, strategy: 'agentic' });

        } catch (error: any) {
            callbacks.onError(error.message || 'Unknown error occurred');
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
