export type EntityType = 'person' | 'place' | 'topic';

export interface Entity {
  type: EntityType;
  name: string;
  mentions: number;
}

/**
 * Domain Entity representing a biographical chapter.
 * Enforces invariants and business rules.
 */
export class Chapter {
  constructor(
    public id: string,
    public sessionId: string,
    public userId: string,
    public title: string,
    public content: string,
    public excerpt: string,
    public createdAt: Date,
    public audioHighlightUrl?: string,
    public audioDuration?: number,
    public pdfUrl?: string,
    public entities?: Entity[],
    public metadata?: {
      sessionNumber: number;
      wordCount: number;
      emotionalTone: string;
      lifePeriod?: string;
      [key: string]: any;
    },
    // AI-generated story images (stored as data URIs)
    public coverImageUrl?: string,
    public bannerImageUrl?: string
  ) { }

  /**
   * Validates the chapter state invariants.
   * Throws an error if the chapter is invalid.
   */
  public validate(): void {
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Chapter title cannot be empty.');
    }
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Chapter content cannot be empty.');
    }
    if (!this.userId) {
      throw new Error('Chapter must belong to a user.');
    }
    if (!this.sessionId) {
      throw new Error('Chapter must be associated with a session.');
    }
    if (this.content.length < 50) {
      throw new Error('Chapter content is too short to be valid.');
    }
  }

  /**
   * Updates the audio highlight URL.
   */
  public setAudioHighlight(url: string, duration: number): void {
    this.audioHighlightUrl = url;
    this.audioDuration = duration;
  }

  /**
   * Sets the AI-generated cover images for the chapter.
   * @param coverUrl - Card thumbnail image (data URI or URL)
   * @param bannerUrl - Immersive banner image (data URI or URL)
   */
  public setCoverImages(coverUrl: string, bannerUrl?: string): void {
    this.coverImageUrl = coverUrl;
    if (bannerUrl) {
      this.bannerImageUrl = bannerUrl;
    }
  }
}

