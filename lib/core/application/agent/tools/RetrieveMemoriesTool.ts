import { z } from 'zod';
import {
  ToolContract,
  ToolResult,
  ToolExecutionContext,
  ToolMetadata,
  ToolCapability,
  ToolPermission
} from './ToolContracts';
import { AgentMemoryPort } from '../../ports/AgentMemoryPort';
import { MemoryType } from '../memory/AgentMemory';

/**
 * Tool for retrieving relevant memories from past interactions.
 */
export class RetrieveMemoriesTool implements ToolContract<{ query: string }, any[]> {
  public metadata: ToolMetadata = {
    id: 'retrieve-memories',
    name: 'Retrieve Memories',
    description: 'Retrieve relevant memories from past interactions to provide personalized context.',
    usageHint: 'Use this when you need to recall specific facts the user mentioned before, like family names, past events, or preferences.',
    version: '1.0.0',
    capabilities: [ToolCapability.READ],
    defaultPermission: ToolPermission.ALLOWED,
    estimatedCostCents: 0.1,
    estimatedLatencyMs: 500,
    enabled: true,
  };

  public inputSchema = z.object({
    query: z.string().min(1).describe('The search query or topic to recall memories about'),
  });

  public outputSchema = z.array(z.any());

  constructor(private memoryPortFactory: (userId: string) => AgentMemoryPort) { }

  async execute(input: { query: string }, context: ToolExecutionContext): Promise<ToolResult<any[]>> {
    const startTime = Date.now();
    try {
      // Get user-specific memory manager
      const memoryManager = this.memoryPortFactory(context.userId);

      // Query memories
      const memories = await memoryManager.query({
        query: input.query,
        limit: 5,
        types: [MemoryType.EPISODIC, MemoryType.SEMANTIC, MemoryType.LONG_TERM],
        includeRelated: true
      });

      return {
        success: true,
        data: memories,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: `Failed to retrieve memories: ${(error as Error).message}`,
          retryable: true,
        },
        durationMs: Date.now() - startTime
      };
    }
  }
}
