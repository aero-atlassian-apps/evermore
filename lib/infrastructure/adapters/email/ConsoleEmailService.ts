import { EmailServicePort } from '../../../core/application/ports/EmailServicePort';

export class ConsoleEmailService implements EmailServicePort {
  async sendAlert(to: string, subject: string, body: string): Promise<void> {
    console.log(`[MOCK EMAIL SERVICE] Sending email to ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
  }

  async sendChapterNotification(chapterId: string, email: string): Promise<void> {
    console.log(`[MOCK EMAIL SERVICE] Sending chapter notification for ${chapterId} to ${email}`);
  }
}
