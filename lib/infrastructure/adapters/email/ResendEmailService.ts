import { EmailServicePort } from '../../../core/application/ports/EmailServicePort';

export class ResendEmailService implements EmailServicePort {
  async sendChapterNotification(chapterId: string, email: string): Promise<void> {
    console.log(`Sending email for chapter ${chapterId} to ${email}`);
    // Mock implementation for now, can be swapped with Resend SDK
  }

  async sendAlert(to: string, subject: string, body: string): Promise<void> {
    console.log(`[RESEND] Sending alert to ${to}: ${subject}`);
    // Mock implementation
  }
}
