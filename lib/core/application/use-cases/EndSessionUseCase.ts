import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { JobRepository } from '../../domain/repositories/JobRepository';
import { GenerateChapterUseCase } from './GenerateChapterUseCase';
import { logger } from '../Logger';

export class EndSessionUseCase {
  constructor(
    private sessionRepository: SessionRepository,
    private jobRepository: JobRepository,
    private generateChapterUseCase?: GenerateChapterUseCase
  ) { }

  async execute(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Use transaction to update status
    await this.sessionRepository.completeSessionTransaction(sessionId);
    logger.info('[EndSessionUseCase] Session completed and transaction finalized', { sessionId });

    // Always queue background job for chapter generation
    await this.jobRepository.create('generate_chapter', { sessionId });
    logger.info('[EndSessionUseCase] Chapter generation job queued', { sessionId });
  }
}
