
export class EmailService {
    async sendChapterNotification(chapterId: string) {
        console.log(`[Mock Email Service] Sending chapter notification for chapter ${chapterId}`);
        // In real impl, would use Resend or similar
    }
}
