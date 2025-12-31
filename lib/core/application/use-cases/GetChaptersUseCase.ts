import { ChapterRepository } from '../../domain/repositories/ChapterRepository';
import { Chapter } from '../../domain/entities/Chapter';

export class GetChaptersUseCase {
  constructor(private chapterRepository: ChapterRepository) {}

  async execute(userId: string): Promise<Chapter[]> {
    return this.chapterRepository.findByUserId(userId);
  }
}
