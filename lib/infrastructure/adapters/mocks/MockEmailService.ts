import { EmailServicePort } from '../../../core/application/ports/EmailServicePort';

export class MockEmailService implements EmailServicePort {
  async sendAlert(to: string, subject: string, body: string): Promise<void> {
    console.log(`[MockEmailService] Sending alert to ${to}: ${subject}`);
  }

  async sendChapterNotification(chapterId: string, email: string): Promise<void> {
    console.log(`[MockEmailService] Sending chapter notification for ${chapterId} to ${email}`);
  }
}
