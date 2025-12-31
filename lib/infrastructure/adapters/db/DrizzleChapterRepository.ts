import { ChapterRepository } from '../../../core/domain/repositories/ChapterRepository';
import { Chapter } from '../../../core/domain/entities/Chapter';
import { db } from './index';
import { chapters } from './schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export class DrizzleChapterRepository implements ChapterRepository {
  async create(chapter: Chapter): Promise<Chapter> {
    // Extract base64 data from data URIs if present
    const coverImageData = this.extractBase64FromDataUri(chapter.coverImageUrl);
    const bannerImageData = this.extractBase64FromDataUri(chapter.bannerImageUrl);

    const [created] = await db.insert(chapters).values({
      id: chapter.id,
      sessionId: chapter.sessionId,
      userId: chapter.userId,
      title: chapter.title,
      content: chapter.content,
      excerpt: chapter.excerpt,
      entities: chapter.entities,
      metadata: chapter.metadata,
      audioHighlightUrl: chapter.audioHighlightUrl,
      audioDuration: chapter.audioDuration,
      pdfUrl: chapter.pdfUrl,
      coverImageData,
      bannerImageData
    }).returning();
    return this.mapToEntity(created);
  }

  async findByUserId(userId: string): Promise<Chapter[]> {
    const found = await db.select()
      .from(chapters)
      .where(eq(chapters.userId, userId))
      .orderBy(desc(chapters.createdAt));
    return found.map(this.mapToEntity.bind(this));
  }

  async findById(id: string): Promise<Chapter | null> {
    const [found] = await db.select().from(chapters).where(eq(chapters.id, id));
    return found ? this.mapToEntity(found) : null;
  }

  async findBySessionId(sessionId: string): Promise<Chapter[]> {
    const found = await db.select()
      .from(chapters)
      .where(eq(chapters.sessionId, sessionId))
      .orderBy(desc(chapters.createdAt));
    return found.map(this.mapToEntity.bind(this));
  }

  async findByEntity(userId: string, entityType: string, entityName: string): Promise<Chapter[]> {
    const found = await db.select()
      .from(chapters)
      .where(
        and(
          eq(chapters.userId, userId),
          sql`${chapters.entities} @> ${JSON.stringify([{ type: entityType, name: entityName }])}::jsonb`
        )
      )
      .orderBy(desc(chapters.createdAt));

    return found.map(this.mapToEntity.bind(this));
  }

  /**
   * Converts base64 stored in DB to data URI for frontend consumption.
   */
  private mapToEntity(raw: any): Chapter {
    // Convert stored base64 to data URIs
    const coverImageUrl = raw.coverImageData
      ? `data:image/png;base64,${raw.coverImageData}`
      : undefined;
    const bannerImageUrl = raw.bannerImageData
      ? `data:image/png;base64,${raw.bannerImageData}`
      : undefined;

    return new Chapter(
      raw.id,
      raw.sessionId,
      raw.userId,
      raw.title,
      raw.content,
      raw.excerpt,
      raw.createdAt,
      raw.audioHighlightUrl,
      raw.audioDuration,
      raw.pdfUrl,
      raw.entities,
      raw.metadata,
      coverImageUrl,
      bannerImageUrl
    );
  }

  /**
   * Extracts base64 data from a data URI (e.g., "data:image/png;base64,ABC123...")
   */
  private extractBase64FromDataUri(dataUri?: string): string | null {
    if (!dataUri) return null;
    if (dataUri.startsWith('data:')) {
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      return base64Match ? base64Match[1] : null;
    }
    // If it's already raw base64, return as-is
    return dataUri;
  }

  async update(id: string, data: Partial<Pick<Chapter, 'audioHighlightUrl' | 'audioDuration' | 'metadata' | 'coverImageUrl' | 'bannerImageUrl'>>): Promise<Chapter | null> {
    // Build update object only with provided fields
    const updateData: any = {};
    if (data.audioHighlightUrl !== undefined) updateData.audioHighlightUrl = data.audioHighlightUrl;
    if (data.audioDuration !== undefined) updateData.audioDuration = data.audioDuration;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.coverImageUrl !== undefined) updateData.coverImageData = this.extractBase64FromDataUri(data.coverImageUrl);
    if (data.bannerImageUrl !== undefined) updateData.bannerImageData = this.extractBase64FromDataUri(data.bannerImageUrl);

    const [updated] = await db.update(chapters)
      .set(updateData)
      .where(eq(chapters.id, id))
      .returning();
    return updated ? this.mapToEntity(updated) : null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(chapters).where(eq(chapters.id, id));
  }
}


