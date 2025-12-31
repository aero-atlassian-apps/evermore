
import { OpenAIClient } from '@/lib/infrastructure/adapters/ai/OpenAIClient';
import {
  SensoryDeepeningStrategy,
  TemporalThreadingStrategy,
  GracefulExitStrategy
} from './strategies';
import { SessionContext } from '@/lib/core/domain/value-objects/SessionContext';
import { QuestioningStrategy } from '@/lib/core/application/ports/QuestioningStrategyPort';

export class ConversationalistAgent {
  private openai: OpenAIClient;
  private strategies: Map<string, QuestioningStrategy>;

  constructor() {
    this.openai = new OpenAIClient();
    this.strategies = new Map([
      ['sensory_deepening', new SensoryDeepeningStrategy()],
      ['temporal_threading', new TemporalThreadingStrategy()],
      ['graceful_exit', new GracefulExitStrategy()]
    ]);
  }

  async generateNextQuestion(
    userUtterance: string,
    context: SessionContext
  ): Promise<{ text: string; strategy: string }> {
    // 1. Assess user state
    const userState = this.assessUserState(userUtterance, context);

    // 2. Select strategy
    const strategyName = this.selectStrategy(userState, context);
    const strategy = this.strategies.get(strategyName)!;

    // 3. Build prompt
    const prompt = strategy.buildPrompt(userUtterance, context);

    // 4. Generate question
    const response = await this.openai.complete({
      messages: [
        { role: 'system', content: prompt.system },
        ...context.history.map(msg => ({
          role: msg.speaker === 'agent' ? 'assistant' : 'user',
          content: msg.text
        })),
        { role: 'user', content: userUtterance }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return {
      text: response.choices[0].message.content,
      strategy: strategyName
    };
  }

  private assessUserState(utterance: string, context: SessionContext) {
    const words = utterance.split(/\s+/);

    return {
      wordCount: words.length,
      sensoryWordCount: this.countSensoryWords(words),
      sessionDuration: context.history.length,
      sentiment: this.analyzeSentiment(utterance)
    };
  }

  private selectStrategy(userState: any, context: SessionContext): string {
    // If user response is very brief, use sensory deepening
    if (userState.wordCount < 15 && userState.sensoryWordCount === 0) {
      return 'sensory_deepening';
    }

    // If we can connect to past memories, use temporal threading
    if (context.memories.length > 0) {
      return 'temporal_threading';
    }

    // If session is long, prepare graceful exit
    if (userState.sessionDuration > 30 && userState.wordCount < 10) {
      return 'graceful_exit';
    }

    // Default: sensory deepening
    return 'sensory_deepening';
  }

  private countSensoryWords(words: string[]): number {
    const sensoryTerms = ['smell', 'sound', 'feel', 'taste', 'look', 'color', 'texture'];
    return words.filter(w => sensoryTerms.includes(w.toLowerCase())).length;
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    // Simple sentiment (use proper lib like sentiment.js in production)
    const positiveWords = ['love', 'happy', 'great', 'wonderful', 'amazing'];
    const negativeWords = ['sad', 'difficult', 'hard', 'pain', 'lost'];

    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}
