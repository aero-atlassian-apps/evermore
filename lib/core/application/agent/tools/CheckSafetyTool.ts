import { z } from 'zod';
import {
  ToolContract,
  ToolResult,
  ToolExecutionContext,
  ToolMetadata,
  ToolCapability,
  ToolPermission
} from './ToolContracts';
import { ContentSafetyGuard } from '../../services/ContentSafetyGuard';

/**
 * Tool for checking content safety and well-being risks.
 */
export class CheckSafetyTool implements ToolContract<{ text: string }, string> {
  public metadata: ToolMetadata = {
    id: 'check-safety',
    name: 'Check Safety',
    description: 'Check if text content is safe or contains risks for the user.',
    usageHint: 'Use this to validate user input or your own intended output if you suspect any psychological distress or safety risks.',
    version: '1.0.0',
    capabilities: [ToolCapability.READ, ToolCapability.EXTERNAL],
    defaultPermission: ToolPermission.ALLOWED,
    estimatedCostCents: 0.05,
    estimatedLatencyMs: 300,
    enabled: true,
  };

  public inputSchema = z.object({
    text: z.string().min(1).describe('The text content to analyze for safety'),
  });

  public outputSchema = z.enum(['SAFE', 'RISK_DETECTED']);

  constructor(
    private safetyGuard: ContentSafetyGuard,
    private emergencyContact?: string
  ) { }

  async execute(input: { text: string }, context: ToolExecutionContext): Promise<ToolResult<string>> {
    const startTime = Date.now();
    try {
      const isRisky = await this.safetyGuard.monitor(
        input.text,
        context.userId,
        context.sessionId,
        this.emergencyContact
      );

      return {
        success: true,
        data: isRisky ? 'RISK_DETECTED' : 'SAFE',
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SAFETY_CHECK_FAILED',
          message: `Safety analysis failed: ${(error as Error).message}`,
          retryable: true,
        },
        durationMs: Date.now() - startTime
      };
    }
  }
}
