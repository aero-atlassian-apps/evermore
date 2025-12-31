import { Chapter } from '../entities/Chapter';

export interface ChapterRepository {
  create(chapter: Chapter): Promise<Chapter>;
  findByUserId(userId: string): Promise<Chapter[]>;
  findById(id: string): Promise<Chapter | null>;
  findBySessionId(sessionId: string): Promise<Chapter[]>;
  findByEntity(userId: string, entityType: string, entityName: string): Promise<Chapter[]>;
  update(id: string, data: Partial<Pick<Chapter, 'audioHighlightUrl' | 'audioDuration' | 'metadata' | 'coverImageUrl' | 'bannerImageUrl'>>): Promise<Chapter | null>;
  delete(id: string): Promise<void>;
}


