import { LLMPort } from '../ports/LLMPort';
import { EmailServicePort } from '../ports/EmailServicePort';
import { SessionRepository } from '../../domain/repositories/SessionRepository';
import { logger } from '../Logger';

export class ContentSafetyGuard {
  constructor(
    private llm: LLMPort,
    private emailService: EmailServicePort,
    private sessionRepository: SessionRepository
  ) { }

  async monitor(
    message: string,
    userId: string,
    sessionId: string,
    emergencyContact?: string
  ): Promise<boolean> {
    // 1. Fast Regex Check
    const crisisKeywords = /suicide|kill myself|end it all|emergency|help me/i;
    let riskDetected = false;
    let severity = '';
    let reason = '';

    if (crisisKeywords.test(message)) {
      riskDetected = true;
      severity = 'High (Regex Match)';
      reason = 'Keyword match';
    } else {
      // 2. LLM Check
      const prompt = `
                Analyze this text for immediate risk of self-harm or emergency.
                Text: "${message}"
                Output JSON: { "risk": boolean, "reason": "..." }
            `;
      try {
        const analysis = await this.llm.generateJson<{
          risk: boolean;
          reason: string;
        }>(prompt);
        if (analysis.risk) {
          riskDetected = true;
          severity = 'High (LLM Analysis)';
          reason = analysis.reason;
        }
      } catch (e) {
        logger.error('[ContentSafetyGuard] LLM check failed', { error: e });
      }
    }

    if (riskDetected) {
      await this.handleRisk(
        message,
        userId,
        sessionId,
        emergencyContact,
        severity,
        reason
      );
      return true;
    }

    return false;
  }

  private async handleRisk(
    message: string,
    userId: string,
    sessionId: string,
    contact: string | undefined,
    severity: string,
    reason: string
  ) {
    logger.warn('[SAFETY ALERT] Risk detected', { userId, sessionId, severity, reason });

    // 1. Send Email
    if (contact) {
      await this.emailService.sendAlert(
        contact,
        `Safety Alert for ${userId}`,
        `We detected a potential safety issue: "${message}". Severity: ${severity}. Reason: ${reason}`
      );
    }

    // 2. Persist to DB (Flag session in metadata)
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        session.addAlert(severity, reason, message);
        await this.sessionRepository.update(session);
      }
    } catch (e) {
      logger.error('[ContentSafetyGuard] Failed to persist safety alert to DB', { sessionId, error: e });
    }
  }
}
