import { describe, it, expect, vi, beforeEach } from 'vitest';

// We must mock BEFORE importing the module that uses the mock
vi.mock('@google-cloud/vertexai', () => {
  return {
    VertexAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: { candidates: [{ content: { parts: [{ text: '{"text": "Mock Question", "strategy": "mock"}' }] } }] }
          })
        };
      }
    },
    GenerativeModel: class {},
    Part: class {}
  };
});

vi.mock('@elevenlabs/elevenlabs-js', () => {
  return {
    ElevenLabsClient: class {
      conversationalAi = {
        createConversation: vi.fn().mockResolvedValue({
          agent_id: 'mock-agent-id',
          conversation_id: 'mock-conv-id'
        })
      };
      textToSpeech = {
          convert: vi.fn().mockResolvedValue(['mock', 'audio'])
      };
    }
  };
});

// Import after mocks
import { GeminiService } from '../../lib/infrastructure/adapters/ai/GeminiService';
import { AIServicePort } from '../../lib/core/application/ports/AIServicePort';

describe('Voice Orchestration Integration', () => {
  let geminiService: AIServicePort;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_AGENT_ID = 'test-agent';
    geminiService = new GeminiService();
  });

  it('should orchestrate startVoiceConversation by generating a goal and starting ElevenLabs', async () => {
    const memories = [{ text: 'I grew up in Ohio' }];
    const result = await geminiService.startVoiceConversation('user1', 'session1', 'Arthur', memories);

    expect(result.agentId).toBe('mock-agent-id');
    expect(result.conversationId).toBe('mock-conv-id');
  });

  it('should analyze image and attempt to parse response', async () => {
    const result = await geminiService.analyzeImage('base64', 'image/jpeg');
    expect(result).toBeDefined();
  });
});
