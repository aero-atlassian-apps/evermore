/**
 * Mailtrap Email Service - Real Email Sending via Mailtrap API
 * 
 * Uses Mailtrap's sandbox API for development/testing.
 * For production, switch to production Mailtrap or Resend.
 */

import { EmailServicePort } from '../../../core/application/ports/EmailServicePort';
import { logger } from '../../../core/application/Logger';

interface MailtrapConfig {
    apiToken: string;
    inboxId: string;
    fromEmail: string;
    fromName: string;
}

export class MailtrapEmailService implements EmailServicePort {
    private config: MailtrapConfig;
    private apiUrl: string;

    constructor(config?: Partial<MailtrapConfig>) {
        this.config = {
            apiToken: config?.apiToken || process.env.MAILTRAP_API_TOKEN || '',
            inboxId: config?.inboxId || process.env.MAILTRAP_INBOX_ID || '4281111',
            fromEmail: config?.fromEmail || process.env.MAILTRAP_FROM_EMAIL || 'evermore@demomailtrap.co',
            fromName: config?.fromName || process.env.MAILTRAP_FROM_NAME || 'Evermore',
        };

        this.apiUrl = `https://sandbox.api.mailtrap.io/api/send/${this.config.inboxId}`;

        if (!this.config.apiToken) {
            logger.warn('[MailtrapEmailService] No API token configured - emails will not be sent');
        }
    }

    async sendChapterNotification(chapterId: string, email: string): Promise<void> {
        const subject = '📖 A New Chapter Has Been Created';
        const body = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FDFCF8;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3D3430; font-size: 28px; margin: 0;">✨ New Story Chapter</h1>
        </div>
        
        <p style="color: #5C5552; font-size: 18px; line-height: 1.6;">
          A beautiful new chapter has been created from your recent conversation. 
          The memories shared have been carefully crafted into a story worth preserving.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chapter/${chapterId}" 
             style="display: inline-block; padding: 16px 32px; background: #E07A5F; color: white; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
            Read Your Story →
          </a>
        </div>
        
        <p style="color: #756A63; font-size: 14px; text-align: center; margin-top: 40px;">
          With love,<br/>
          <strong>Evermore</strong> - Your AI Biographer
        </p>
      </div>
    `;

        await this.sendEmail(email, subject, body);
    }

    async sendAlert(to: string, subject: string, body: string): Promise<void> {
        const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FFF5F5; border-left: 4px solid #E07A5F;">
        <h2 style="color: #C53030; margin: 0 0 16px 0;">⚠️ ${subject}</h2>
        <p style="color: #3D3430; font-size: 16px; line-height: 1.6;">
          ${body}
        </p>
        <p style="color: #756A63; font-size: 12px; margin-top: 20px;">
          This is an automated safety alert from Evermore.
        </p>
      </div>
    `;

        await this.sendEmail(to, subject, htmlBody);
    }

    /**
     * Send family invitation email
     */
    async sendFamilyInvitation(to: string, seniorName: string, inviteLink: string): Promise<void> {
        const subject = `💌 ${seniorName} has invited you to Evermore`;
        const body = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FDFCF8;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3D3430; font-size: 28px; margin: 0;">You're Invited! 💝</h1>
        </div>
        
        <p style="color: #5C5552; font-size: 18px; line-height: 1.6;">
          <strong>${seniorName}</strong> would love to share their life stories with you through Evermore.
        </p>
        
        <p style="color: #5C5552; font-size: 16px; line-height: 1.6;">
          Evermore is an AI companion that helps preserve precious memories through 
          meaningful conversations. As a family member, you'll be able to read and 
          cherish the stories that matter most.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" 
             style="display: inline-block; padding: 16px 32px; background: #E07A5F; color: white; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
            Accept Invitation →
          </a>
        </div>
        
        <p style="color: #756A63; font-size: 14px; text-align: center; margin-top: 40px;">
          With love,<br/>
          <strong>Evermore</strong> - Preserving Stories That Matter
        </p>
      </div>
    `;

        await this.sendEmail(to, subject, body);
    }

    private async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
        if (!this.config.apiToken) {
            logger.warn('[MailtrapEmailService] Skipping email - no API token', { to, subject });
            return;
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: {
                        email: this.config.fromEmail,
                        name: this.config.fromName,
                    },
                    to: [{ email: to }],
                    subject,
                    html: htmlBody,
                    category: 'Evermore Notification',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Mailtrap API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            logger.info('[MailtrapEmailService] Email sent successfully', {
                to,
                subject,
                messageId: result.message_ids?.[0]
            });

        } catch (error: any) {
            logger.error('[MailtrapEmailService] Failed to send email', {
                to,
                subject,
                error: error.message
            });
            // Don't throw - email failure shouldn't break the main flow
        }
    }
}
