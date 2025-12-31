export interface EmailServicePort {
  sendAlert(to: string, subject: string, body: string): Promise<void>;
  sendChapterNotification(chapterId: string, email: string): Promise<void>;
}
