import { DrizzleUserRepository } from '../adapters/db/DrizzleUserRepository';
import { DrizzleSessionRepository } from '../adapters/db/DrizzleSessionRepository';
import { DrizzleChapterRepository } from '../adapters/db/DrizzleChapterRepository';
import { DrizzleJobRepository } from '../adapters/db/DrizzleJobRepository';
import { DrizzleInvitationRepository } from '../adapters/db/DrizzleInvitationRepository';

// New Adapters
import { GoogleVertexAdapter } from '../adapters/ai/GoogleVertexAdapter';
import { GoogleEmbeddingAdapter } from '../adapters/ai/GoogleEmbeddingAdapter';
import { ElevenLabsAdapter } from '../adapters/speech/ElevenLabsAdapter';

import { ManualVoiceAgentAdapter } from '../adapters/speech/ManualVoiceAgentAdapter';
import { AoTChapterGeneratorAdapter } from '../adapters/ai/AoTChapterGeneratorAdapter';
import { PineconeStore } from '../adapters/vector/PineconeStore';
import { ResendEmailService } from '../adapters/email/ResendEmailService';
import { MailtrapEmailService } from '../adapters/email/MailtrapEmailService';
import { PDFService } from '../adapters/biographer/PDFService';

// Domain Services / Application Services
import { ContentSafetyGuard } from '../../core/application/services/ContentSafetyGuard';
import { SessionGoalArchitect } from '../../core/application/services/SessionGoalArchitect';
import { UserProfileUpdater } from '../../core/application/services/UserProfileUpdater';
import { InvitationScheduler } from '../../core/application/services/InvitationScheduler';

// Mocks
import { MockAIService } from '../adapters/mocks/MockAIService';
import { MockVectorStore } from '../adapters/mocks/MockVectorStore';
import { MockEmailService } from '../adapters/mocks/MockEmailService';
import { MockChapterGeneratorAdapter } from '../adapters/mocks/MockChapterGeneratorAdapter';
import { MockLLM } from '../adapters/mocks/MockLLM';
import { MockSpeechAdapter } from '../adapters/mocks/MockSpeechAdapter';

// Use Cases
import { CreateUserUseCase } from '../../core/application/use-cases/CreateUserUseCase';
import { StartSessionUseCase } from '../../core/application/use-cases/StartSessionUseCase';
import { ProcessMessageUseCase } from '../../core/application/use-cases/ProcessMessageUseCase';
import { EndSessionUseCase } from '../../core/application/use-cases/EndSessionUseCase';
import { GenerateChapterUseCase } from '../../core/application/use-cases/GenerateChapterUseCase';
import { GetChaptersUseCase } from '../../core/application/use-cases/GetChaptersUseCase';
import { AnalyzeSessionImageUseCase } from '../../core/application/use-cases/AnalyzeSessionImageUseCase';
import { ExportBookUseCase } from '../../core/application/use-cases/ExportBookUseCase';
import { StreamingProcessMessageUseCase } from '../../core/application/use-cases/StreamingProcessMessageUseCase';

import { AIServicePort } from '../../core/application/ports/AIServicePort';
import { LLMPort } from '../../core/application/ports/LLMPort';

const useMocks = process.env.USE_MOCKS === 'true';
const llmProvider_env = process.env.LLM_PROVIDER || 'auto'; // 'huggingface', 'google_ai', 'vertex', 'auto', 'mock'

// Singletons
export const userRepository = new DrizzleUserRepository();
export const sessionRepository = new DrizzleSessionRepository();
export const chapterRepository = new DrizzleChapterRepository();
export const jobRepository = new DrizzleJobRepository();
const invitationRepository = new DrizzleInvitationRepository();

// --- ADAPTERS CONFIGURATION ---
import { GoogleSpeechAdapter } from '../adapters/speech/GoogleSpeechAdapter';

function selectSpeechProvider() {
    try {
        // Use Google Cloud Speech-to-Text for STT (same billing as Vertex AI)
        const googleSTT = new GoogleSpeechAdapter();
        // ElevenLabs for TTS, Google for STT (fallback) and TTS (fallback)
        return new ElevenLabsAdapter(googleSTT, googleSTT);
    } catch (e: any) {
        console.warn('[DI] ElevenLabsAdapter/GoogleSpeechAdapter init failed:', e.message);
        console.warn('[DI] Falling back to MockSpeechAdapter (Safe for Build/Dev)');
        return new MockSpeechAdapter();
    }
}

export const speechProvider = selectSpeechProvider();

// --- LLM PROVIDER SELECTION ---
console.log('[DI] Container re-evaluating providers...');
// Priority: explicit LLM_PROVIDER > USE_MOCKS > auto-detect based on available keys
import { GoogleAIStudioAdapter } from '../adapters/ai/GoogleAIStudioAdapter';
import { HuggingFaceLLMAdapter } from '../adapters/ai/HuggingFaceLLMAdapter';
import { getLLMGateway, LLMGateway } from '../adapters/ai/LLMGateway';

function selectLLMProvider() {
    // Explicit mock mode
    if (useMocks) {
        console.log('[DI] Using MockLLM (USE_MOCKS=true)');
        return new MockLLM();
    }

    // Explicit provider selection
    switch (llmProvider_env) {
        case 'huggingface':
            try {
                console.log('[DI] Attempting HuggingFaceLLMAdapter...');
                return new HuggingFaceLLMAdapter();
            } catch (e: any) {
                console.warn('[DI] HuggingFaceLLMAdapter failed:', e.message);
                console.log('[DI] Falling back to MockLLM');
                return new MockLLM();
            }
        case 'google_ai':
            try {
                console.log('[DI] Attempting GoogleAIStudioAdapter...');
                return new GoogleAIStudioAdapter();
            } catch (e: any) {
                console.warn('[DI] GoogleAIStudioAdapter failed:', e.message);
                console.log('[DI] Falling back to MockLLM');
                return new MockLLM();
            }
        case 'vertex':
            try {
                console.log('[DI] Attempting GoogleVertexAdapter...');
                return new GoogleVertexAdapter();
            } catch (e: any) {
                console.warn('[DI] GoogleVertexAdapter failed:', e.message);
                console.log('[DI] Falling back to MockLLM');
                return new MockLLM();
            }
        case 'mock':
            console.log('[DI] Using MockLLM');
            return new MockLLM();
        case 'auto':
        default:
            // Auto-detect: try adapters in order of preference (Vertex AI first)
            if (process.env.GOOGLE_CLOUD_PROJECT) {
                try {
                    console.log('[DI] Auto-selected GoogleVertexAdapter (GOOGLE_CLOUD_PROJECT found)');
                    return new GoogleVertexAdapter();
                } catch (e: any) {
                    console.warn('[DI] GoogleVertexAdapter construction failed:', e.message);
                }
            }
            if (process.env.GOOGLE_AI_API_KEY) {
                try {
                    console.log('[DI] Auto-selected GoogleAIStudioAdapter (GOOGLE_AI_API_KEY found)');
                    return new GoogleAIStudioAdapter();
                } catch (e: any) {
                    console.warn('[DI] GoogleAIStudioAdapter construction failed:', e.message);
                }
            }
            if (process.env.HUGGINGFACE_API_KEY) {
                try {
                    console.log('[DI] Auto-selected HuggingFaceLLMAdapter (HUGGINGFACE_API_KEY found)');
                    return new HuggingFaceLLMAdapter();
                } catch (e: any) {
                    console.warn('[DI] HuggingFaceLLMAdapter construction failed:', e.message);
                }
            }
            // Fallback to mock
            console.log('[DI] No LLM API keys found or all adapters failed, using MockLLM.');
            return new MockLLM();
    }
}

export const llmProvider = selectLLMProvider();

// LLM Gateway - Wraps llmProvider with rate limiting, queuing, and circuit breaker
// Use llmGateway for production code that needs throughput control
export const llmGateway: LLMGateway = getLLMGateway(llmProvider);


export const embeddingProvider = new GoogleEmbeddingAdapter(process.env.GOOGLE_CLOUD_PROJECT || 'mock-project');

// --- VECTOR STORE SELECTION ---
// Priority: PINECONE_API_KEY → PineconeStore, else → InMemoryVectorStore
import { InMemoryVectorStore } from '../adapters/vector/InMemoryVectorStore';

function selectVectorStore() {
    if (useMocks) {
        console.log('[DI] Using MockVectorStore (USE_MOCKS=true)');
        return new MockVectorStore();
    }

    if (process.env.PINECONE_API_KEY) {
        console.log('[DI] Using PineconeStore (PINECONE_API_KEY found)');
        return new PineconeStore(embeddingProvider);
    }

    // Local development: use in-memory store
    console.log('[DI] Using InMemoryVectorStore (no PINECONE_API_KEY - local dev mode)');
    return new InMemoryVectorStore();
}

export const vectorStore = selectVectorStore();
// Email Service - Prefer Mailtrap for dev/staging, Resend for production
function selectEmailService() {
    if (useMocks) {
        console.log('[DI] Using MockEmailService (USE_MOCKS=true)');
        return new MockEmailService();
    }

    if (process.env.MAILTRAP_API_TOKEN) {
        console.log('[DI] Using MailtrapEmailService (MAILTRAP_API_TOKEN found)');
        return new MailtrapEmailService();
    }

    console.log('[DI] Using ResendEmailService (fallback)');
    return new ResendEmailService();
}

export const emailService = selectEmailService();

// --- IMAGE GENERATION ---
// Mock for local dev, Google Imagen for production
import { ImageGenerationPort } from '../../core/application/ports/ImageGenerationPort';
import { GoogleImagenAdapter } from '../adapters/ai/GoogleImagenAdapter';
import { MockImageGenerator } from '../adapters/mocks/MockImageGenerator';

function selectImageGenerator(): ImageGenerationPort {
    // Only use mocks if explicitly requested
    if (useMocks) {
        console.log('[DI] Using MockImageGenerator (USE_MOCKS=true)');
        return new MockImageGenerator();
    }

    // Production/Staging: try Google Imagen
    if (process.env.GOOGLE_CLOUD_PROJECT) {
        console.log('[DI] Using GoogleImagenAdapter (GOOGLE_CLOUD_PROJECT found)');
        return new GoogleImagenAdapter();
    }

    // Fallback to mock if no credentials
    console.log('[DI] Using MockImageGenerator (no GOOGLE_CLOUD_PROJECT)');
    return new MockImageGenerator();
}


export const imageGenerator = selectImageGenerator();

// AGENTIC Chapter Generator - Uses EnhancedReActAgent with tools
// Replaces simple LLM wrapper with full agent orchestration
import { AgenticChapterGenerator } from '../adapters/ai/AgenticChapterGenerator';

export const chapterGenerator = useMocks
    ? new MockChapterGeneratorAdapter()
    : new AgenticChapterGenerator(llmProvider);

// AGENTIC Storybook Orchestrator - Uses AoT + ReACT + CoT + VectorDB
import { AgenticStorybookOrchestrator } from '../adapters/storybook/AgenticStorybookOrchestrator';
export const storybookOrchestrator = new AgenticStorybookOrchestrator(
    chapterRepository,
    userRepository,
    llmProvider,
    imageGenerator,
    vectorStore
);

// AGENTIC Narration Agent - Emotion-aware TTS preparation
import { AgenticNarrationAgent } from '../adapters/speech/AgenticNarrationAgent';
export const narrationAgent = new AgenticNarrationAgent(llmProvider);

// AGENTIC Vision Agent - Context-aware image analysis
import { AgenticImageAnalysisAgent } from '../adapters/vision/AgenticImageAnalysisAgent';
export const imageAnalysisAgent = new AgenticImageAnalysisAgent(llmProvider);

export const contentSafetyGuard = new ContentSafetyGuard(llmProvider, emailService, sessionRepository);
export const pdfService = new PDFService();
export const userProfileUpdater = new UserProfileUpdater(userRepository);

// STORAGE ADAPTER
import { SupabaseStorageAdapter } from '../adapters/storage/SupabaseStorageAdapter';
export const storageAdapter = new SupabaseStorageAdapter();


import { AgentMemoryManager } from '../../core/application/agent/memory/AgentMemory';
import { AgentMemoryPort } from '../../core/application/ports/AgentMemoryPort';
import { ToolRegistry } from '../../core/application/agent/tools/ToolContracts';
import { RetrieveMemoriesTool } from '../../core/application/agent/tools/RetrieveMemoriesTool';
import { CheckSafetyTool } from '../../core/application/agent/tools/CheckSafetyTool';
import { createDefaultRegistry } from '../../core/application/agent/registry/AgentRegistry';
import { ModelRouter } from '../../core/application/agent/routing/ModelRouter';

export const agentMemoryFactory = (userId: string): AgentMemoryPort => {
    return new AgentMemoryManager(
        userId,
        vectorStore,
        embeddingProvider
    );
};

export const agentMemoryManager = agentMemoryFactory("system");

// --- TOOL REGISTRY ---
export const toolRegistry = new ToolRegistry();
toolRegistry.register(new RetrieveMemoriesTool(agentMemoryFactory));
toolRegistry.register(new CheckSafetyTool(contentSafetyGuard));

// --- AGENT REGISTRY ---
export const modelRouter = new ModelRouter();
export const agentRegistry = createDefaultRegistry(
    llmProvider,
    modelRouter,
    vectorStore,
    embeddingProvider,
    toolRegistry
);

// VoiceAgentProvider: Use ManualVoiceAgentAdapter as fallback if ElevenLabs not available
// SAFETY: Check if speechProvider is actually ElevenLabsAdapter before using its voice agent features
const voiceAgentProvider = !(speechProvider instanceof ElevenLabsAdapter)
    ? new ManualVoiceAgentAdapter()
    : speechProvider;

export const sessionGoalArchitect = new SessionGoalArchitect(llmProvider, voiceAgentProvider);
export const invitationScheduler = new InvitationScheduler(userRepository, invitationRepository);

// --- LEGACY/BRIDGE SUPPORT ---
class AIServiceBridge implements AIServicePort {

    constructor(
        private llm: LLMPort,
        private speech: any, // SpeechPort
        private director: SessionGoalArchitect
    ) { }

    async generateQuestion(userUtterance: string, history: any[], memories: any[], imageContext?: string): Promise<{ text: string; strategy: string }> {
        const prompt = `
            Context: ${JSON.stringify(history)}
            Memories: ${JSON.stringify(memories)}
            Image: ${imageContext || 'None'}
            User: ${userUtterance}
            Generate follow up question JSON: { "text": "...", "strategy": "..." }
         `;
        try {
            return await this.llm.generateJson(prompt);
        } catch {
            return { text: "Tell me more.", strategy: "fallback" };
        }
    }

    async generateChapterAnalysis(transcript: string): Promise<any> {
        return this.llm.generateJson(`Analyze transcript: ${transcript}`, {});
    }

    async generateChapterNarrative(transcript: string, analysis: any): Promise<{ content: string; wordCount: number }> {
        const content = await this.llm.generateText(`Write chapter based on analysis ${JSON.stringify(analysis)} and transcript ${transcript}`);
        return { content, wordCount: content.split(' ').length };
    }

    async startVoiceConversation(userId: string, sessionId: string, userName: string, memories: any[], imageContext?: string): Promise<{ agentId: string; conversationId: string; wsUrl?: string }> {
        throw new Error("Deprecated: Use SessionGoalArchitect directly.");
    }

    async analyzeImage(imageBase64: string, mimeType: string): Promise<{ description: string; detectedEntities: string[]; conversationalTrigger?: string }> {
        const text = await this.llm.analyzeImage(imageBase64, mimeType, "Analyze image. Output JSON: {description, entities, conversationalTrigger}");
        try {
            const clean = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(clean);
        } catch {
            return { description: text, detectedEntities: [] };
        }
    }

    async generateSpeech(text: string, style?: string): Promise<Buffer> {
        return this.speech.textToSpeech(text, { style });
    }
}

export const aiService = useMocks
    ? new MockAIService()
    : new AIServiceBridge(llmProvider, speechProvider, sessionGoalArchitect);


// Use Cases

export const createUserUseCase = new CreateUserUseCase(userRepository);

export const startSessionUseCase = new StartSessionUseCase(
    sessionRepository,
    userRepository,
    sessionGoalArchitect,
    agentMemoryFactory
);

export const processMessageUseCase = new ProcessMessageUseCase(
    sessionRepository,
    userRepository, // Added UserRepository injection
    llmProvider,
    vectorStore,
    contentSafetyGuard,
    agentMemoryFactory
);

export const generateChapterUseCase = new GenerateChapterUseCase(
    chapterRepository,
    sessionRepository,
    userRepository,
    chapterGenerator,
    emailService,
    llmProvider,
    storybookOrchestrator,
    agentMemoryFactory
);

export const analyzeSessionImageUseCase = new AnalyzeSessionImageUseCase(
    sessionRepository,
    llmProvider,
    speechProvider,
    vectorStore
);

export const exportBookUseCase = new ExportBookUseCase(chapterRepository, pdfService);

export const endSessionUseCase = new EndSessionUseCase(sessionRepository, jobRepository, generateChapterUseCase);
export const getChaptersUseCase = new GetChaptersUseCase(chapterRepository);

export const streamingProcessMessageUseCase = new StreamingProcessMessageUseCase(
    sessionRepository,
    userRepository,
    llmProvider,
    vectorStore,
    contentSafetyGuard,
    agentMemoryFactory
);

