export interface StorybookPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  imagePrompt?: string;
}

export class Storybook {
  constructor(
    public readonly id: string,
    public readonly chapterId: string,
    public readonly title: string,
    public readonly pages: StorybookPage[],
    public readonly pdfUrl?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  public setPdfUrl(url: string): Storybook {
    return new Storybook(
      this.id,
      this.chapterId,
      this.title,
      this.pages,
      url,
      this.createdAt,
      new Date()
    );
  }
}
