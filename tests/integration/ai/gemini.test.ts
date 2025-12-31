import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiService } from '../../../lib/infrastructure/adapters/ai/GeminiService';

// Mock dependencies
const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
    candidates: [
        {
        content: {
            parts: [{ text: '{"text": "Mock Question", "strategy": "mock_strategy"}' }]
        }
        }
    ]
    }
});

const mockGetGenerativeModel = vi.fn().mockReturnValue({
    generateContent: mockGenerateContent
});

vi.mock('@google-cloud/vertexai', () => {
  return {
    VertexAI: class {
        getGenerativeModel = mockGetGenerativeModel;
    },
    GenerativeModel: class {},
    Part: class {}
  };
});

const mockCreateConversation = vi.fn().mockResolvedValue({
    agent_id: 'mock-agent-id',
    conversation_id: 'mock-conv-id'
});

vi.mock('@elevenlabs/elevenlabs-js', () => {
  return {
    ElevenLabsClient: class {
        conversationalAi = {
            createConversation: mockCreateConversation
        };
    }
  };
});

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_AGENT_ID = 'test-agent';
    service = new GeminiService();
  });

  it('should generate a question', async () => {
    const result = await service.generateQuestion('Hello', [], []);
    expect(result).toEqual({ text: 'Mock Question', strategy: 'mock_strategy' });
  });

  it('should start a voice conversation', async () => {
    const result = await service.startVoiceConversation('user1', 'session1', 'Alice', []);
    expect(result.agentId).toBe('mock-agent-id');
    expect(result.conversationId).toBe('mock-conv-id');

    expect(mockCreateConversation).toHaveBeenCalledWith(expect.objectContaining({
        agent_id: 'test-agent',
        conversation_config_override: expect.objectContaining({
            agent: expect.objectContaining({
                prompt: expect.objectContaining({
                    first_message: expect.stringContaining('Alice')
                })
            })
        }),
        dynamic_variables: expect.objectContaining({
            user_name: 'Alice',
            session_goal: expect.any(String)
        })
    }));
  });
});
