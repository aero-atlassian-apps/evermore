import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { SessionGoalArchitect } from '../services/SessionGoalArchitect';
import { Session } from '../../domain/entities/Session';
import { randomUUID } from 'crypto';
import { AgentMemoryPort, AgentMemoryFactory } from '../ports/AgentMemoryPort';
import { MemoryType } from '../agent/memory/AgentMemory';

export class StartSessionUseCase {
  constructor(
    private sessionRepository: SessionRepository,
    private userRepository: UserRepository,
    private sessionGoalArchitect: SessionGoalArchitect,
    private memoryFactory: AgentMemoryFactory
  ) { }

  async execute(userId: string): Promise<{ session: Session; aiConfig: any }> {
    const user = await this.userRepository.findById(userId);
    const userName = user ? user.name : 'User';

    // Retrieve memories to ground the initial conversation
    let memories: any[] = [];
    try {
      const memoryAgent = this.memoryFactory(userId);
      const retrieved = await memoryAgent.query({
        limit: 5,
        types: [MemoryType.EPISODIC, MemoryType.LONG_TERM],
        minImportance: 2
      });
      memories = retrieved.map(m => m.content);
      console.log(`[StartSession] Retrieved ${memories.length} memories for user grounding`);
    } catch (err) {
      console.warn('[StartSession] Failed to retrieve memories for grounding:', err);
    }

    // Create session entity
    const session = new Session(
      randomUUID(),
      userId,
      '[]',
      'active',
      new Date()
    );

    // Save to DB
    const createdSession = await this.sessionRepository.create(session);

    // Parse preferences
    let topicsAvoid: string[] = [];
    let topicsLove: string[] = [];

    if (user && user.preferences) {
      try {
        const prefs =
          typeof user.preferences === 'string'
            ? JSON.parse(user.preferences)
            : user.preferences;
        if (prefs.topicsAvoid) topicsAvoid = prefs.topicsAvoid;
        if (prefs.topicsLove) topicsLove = prefs.topicsLove;
      } catch (e) {
        console.warn('Failed to parse user preferences');
      }
    }

    // Start AI conversation via Architect (who orchestrates VoiceAgent)
    const aiConfig = await this.sessionGoalArchitect.determineSessionGoal({
      userId,
      sessionId: createdSession.id,
      userName,
      memories,
      topicsAvoid,
      topicsLove,
    });

    return { session: createdSession, aiConfig };
  }
}
