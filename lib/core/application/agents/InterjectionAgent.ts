import { LLMPort } from '../ports/LLMPort';

export interface InterjectionDecision {
    shouldInterject: boolean;
    type: 'encouragement' | 'followUp' | 'connection' | 'clarification' | 'greeting';
    message: string;
    priority: number; // 0-100, higher = more important
    reason?: string;
}

interface InterjectionContext {
    /** Recent transcript entries */
    recentTranscript: { speaker: 'user' | 'ai'; text: string; timestamp: Date }[];
    /** Duration of current silence in seconds */
    silenceDuration: number;
    /** Session goal from architect */
    sessionGoal?: string;
    /** User's name */
    userName?: string;
    /** Recent memories for context */
    recentMemories?: string[];
    /** Is this the start of the session? */
    isSessionStart?: boolean;
    /** Topic extracted from warm-up phase */
    warmupTopic?: string;
}

/**
 * InterjectionAgent - Decides when and what the AI should say during conversation
 * 
 * Features:
 * - Pause detection interjections (encouragement after silence)
 * - Follow-up questions to deepen story
 * - Memory connections ("That reminds me of...")
 * - Context-aware greeting at session start
 * 
 * Rate limiting: Max 1 interjection per 30 seconds
 */
export class InterjectionAgent {
    private llmProvider: LLMPort;
    private lastInterjectionTime: number = 0;
    private readonly MIN_INTERJECTION_INTERVAL_MS = 30000; // 30 seconds
    private readonly SILENCE_THRESHOLD_SECONDS = 3; // Trigger after 3s silence

    constructor(llmProvider: LLMPort) {
        this.llmProvider = llmProvider;
    }

    /**
     * Decide if AI should interject based on current context
     */
    async shouldInterject(context: InterjectionContext): Promise<InterjectionDecision> {
        // Rate limiting check
        const now = Date.now();
        if (now - this.lastInterjectionTime < this.MIN_INTERJECTION_INTERVAL_MS) {
            return {
                shouldInterject: false,
                type: 'encouragement',
                message: '',
                priority: 0,
                reason: 'Rate limited - too soon since last interjection'
            };
        }

        // Session start greeting
        if (context.isSessionStart) {
            const greeting = await this.generateGreeting(context);
            this.lastInterjectionTime = now;
            return greeting;
        }

        // Silence-triggered interjection
        if (context.silenceDuration >= this.SILENCE_THRESHOLD_SECONDS) {
            const interjection = await this.generatePauseResponse(context);
            if (interjection.shouldInterject) {
                this.lastInterjectionTime = now;
            }
            return interjection;
        }

        return {
            shouldInterject: false,
            type: 'encouragement',
            message: '',
            priority: 0,
            reason: 'No trigger condition met'
        };
    }

    /**
     * Generate context-aware greeting for session start
     */
    private async generateGreeting(context: InterjectionContext): Promise<InterjectionDecision> {
        const userName = context.userName || 'there';
        const hasMemories = context.recentMemories && context.recentMemories.length > 0;
        const hasWarmupTopic = context.warmupTopic && context.warmupTopic.trim().length > 0;

        const prompt = `You are Evermore, a warm and empathetic AI companion for capturing life stories.
        
Generate a brief, warm greeting for ${userName} who is starting a new storytelling session.
${hasWarmupTopic ? `
The user just told you they want to share a story about: "${context.warmupTopic}"
This is the topic they chose in your warm-up conversation. Reference it naturally!
` : ''}
${hasMemories ? `
Recent memories from previous sessions:
${context.recentMemories?.slice(0, 3).join('\n')}
` : ''}
${context.sessionGoal ? `Session goal: ${context.sessionGoal}` : ''}

Guidelines:
- Be warm but not overly enthusiastic
${hasWarmupTopic ? '- Reference their chosen topic and express genuine interest in hearing about it' : '- Ask an open-ended question to start the story'}
- Keep it to 1-2 sentences maximum
- Sound natural, like a kind friend

Respond with ONLY the greeting text, nothing else.`;

        try {
            const responseText = await this.llmProvider.generateText(prompt, {
                temperature: 0.8,
                maxTokens: 100,
            });

            return {
                shouldInterject: true,
                type: 'greeting',
                message: responseText.trim(),
                priority: 100,
                reason: 'Session start greeting'
            };
        } catch (error) {
            console.error('[InterjectionAgent] Greeting generation failed:', error);
            // Fallback greeting
            return {
                shouldInterject: true,
                type: 'greeting',
                message: `Hello ${userName}! I'm so glad you're here. What story would you like to share today?`,
                priority: 100,
                reason: 'Fallback greeting after error'
            };
        }
    }

    /**
     * Generate response when user pauses
     */
    private async generatePauseResponse(context: InterjectionContext): Promise<InterjectionDecision> {
        // Don't interject if no transcript yet
        if (context.recentTranscript.length === 0) {
            return {
                shouldInterject: false,
                type: 'encouragement',
                message: '',
                priority: 0,
                reason: 'No transcript yet'
            };
        }

        // Get last few exchanges
        const lastExchanges = context.recentTranscript.slice(-4).map(t =>
            `${t.speaker === 'user' ? 'User' : 'Evermore'}: ${t.text}`
        ).join('\n');

        const prompt = `You are Evermore, a warm AI companion helping capture life stories.

The user has been sharing their story and has paused for ${context.silenceDuration} seconds.

Recent conversation:
${lastExchanges}

${context.sessionGoal ? `Session goal: ${context.sessionGoal}` : ''}

Decide if you should respond and what to say.

OPTIONS:
1. ENCOURAGE - If they seem to be thinking, gently encourage them to continue
2. FOLLOW_UP - If they just shared something interesting, ask a follow-up question
3. WAIT - If it seems like a natural pause and they'll continue on their own

If you decide to speak, your response should be:
- Very brief (1 sentence max)
- Warm and encouraging, not pushy
- Show you were listening

Respond in this exact format:
DECISION: [ENCOURAGE|FOLLOW_UP|WAIT]
MESSAGE: [Your message if not WAIT, otherwise leave empty]`;

        try {
            const responseText = await this.llmProvider.generateText(prompt, {
                temperature: 0.7,
                maxTokens: 150,
            });

            const text = responseText.trim();
            const decisionMatch = text.match(/DECISION:\s*(ENCOURAGE|FOLLOW_UP|WAIT)/i);
            const messageMatch = text.match(/MESSAGE:\s*(.+)/i);

            if (!decisionMatch || decisionMatch[1].toUpperCase() === 'WAIT') {
                return {
                    shouldInterject: false,
                    type: 'encouragement',
                    message: '',
                    priority: 0,
                    reason: 'LLM decided to wait'
                };
            }

            const decision = decisionMatch[1].toUpperCase();
            const message = messageMatch?.[1]?.trim() || '';

            if (!message) {
                return {
                    shouldInterject: false,
                    type: 'encouragement',
                    message: '',
                    priority: 0,
                    reason: 'No message generated'
                };
            }

            return {
                shouldInterject: true,
                type: decision === 'FOLLOW_UP' ? 'followUp' : 'encouragement',
                message: message,
                priority: decision === 'FOLLOW_UP' ? 70 : 50,
                reason: `Pause response: ${decision}`
            };
        } catch (error) {
            console.error('[InterjectionAgent] Pause response generation failed:', error);
            return {
                shouldInterject: false,
                type: 'encouragement',
                message: '',
                priority: 0,
                reason: 'Error generating response'
            };
        }
    }

    /**
     * Generate a memory connection interjection
     */
    async generateMemoryConnection(
        currentTopic: string,
        relevantMemory: string
    ): Promise<InterjectionDecision> {
        const prompt = `You are Evermore, helping someone share their life story.

They just mentioned: "${currentTopic}"

This reminds you of something they shared before: "${relevantMemory}"

Create a brief, natural interjection that connects these two topics.
Keep it to one sentence. Be warm and conversational.

Respond with ONLY the interjection text.`;

        try {
            const responseText = await this.llmProvider.generateText(prompt, {
                temperature: 0.7,
                maxTokens: 100,
            });

            return {
                shouldInterject: true,
                type: 'connection',
                message: responseText.trim(),
                priority: 80,
                reason: 'Memory connection'
            };
        } catch (error) {
            console.error('[InterjectionAgent] Memory connection failed:', error);
            return {
                shouldInterject: false,
                type: 'connection',
                message: '',
                priority: 0,
                reason: 'Error generating memory connection'
            };
        }
    }

    /**
     * Reset rate limiting (e.g., for new session)
     */
    reset(): void {
        this.lastInterjectionTime = 0;
    }
}
