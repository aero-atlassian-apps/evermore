import { AIServicePort } from '../../../core/application/ports/AIServicePort';
import { VertexAI, GenerativeModel, Part } from '@google-cloud/vertexai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { getGoogleCredentials } from '../../../setup-auth';

export class GeminiService implements AIServicePort {
  private vertexAI: VertexAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  private elevenLabs: ElevenLabsClient;

  constructor() {
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'recall-hackathon';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    // Use shared credential helper
    const credentials = getGoogleCredentials();
    const googleAuthOptions = credentials ? { credentials } : undefined;

    this.vertexAI = new VertexAI({
      project,
      location,
      googleAuthOptions
    });
    this.model = this.vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite-preview-02-05',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    });
    this.visionModel = this.vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite-preview-02-05',
    });
    this.elevenLabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY || 'mock-key',
    });
  }

  private async retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 2);
    }
  }

  async generateQuestion(
    userUtterance: string,
    history: any[],
    memories: any[],
    imageContext?: string
  ): Promise<{ text: string; strategy: string }> {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return { text: "That's interesting, tell me more.", strategy: "sensory_deepening" };
      }

      const prompt = `
        You are 'Evermore', an empathetic biographer interviewing a senior.
        History: ${JSON.stringify(history)}
        Memories: ${JSON.stringify(memories)}
        ${imageContext ? `USER JUST SHOWED A PHOTO. ANALYSIS: ${imageContext}` : ''}
        User said: "${userUtterance}"

        Generate a follow-up question.
        Strategy: If they mentioned an emotion, dig deeper. If they listed facts, ask for feelings.
        ${imageContext ? 'Context: The user is holding a photo. Ask specifically about the people or place in it.' : ''}

        Output JSON: { "text": "Question text", "strategy": "strategy_name" }
      `;

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.candidates?.[0].content.parts[0].text;
      if (!responseText) throw new Error("No response");

      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("Gemini generateQuestion failed:", error);
      return { text: "I see. Please go on.", strategy: "fallback_generic" };
    }
  }

  async generateChapterAnalysis(transcript: string): Promise<any> {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT) return { title: "Mock Analysis", entities: [] };
      const prompt = `Analyze this transcript for a biography chapter. Transcript: ${transcript}. Output JSON with title, entities, tone, period.`;
      const result = await this.model.generateContent(prompt);
      const txt = result.response.candidates?.[0].content.parts[0].text || "{}";
      return JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim());
    } catch (error) {
      return { title: "Analysis Failed", entities: [] };
    }
  }

  async generateChapterNarrative(transcript: string, analysis: any): Promise<{ content: string; wordCount: number }> {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT) return { content: "Mock content", wordCount: 10 };
      const prompt = `Write a biography chapter. Analysis: ${JSON.stringify(analysis)}. Transcript: ${transcript}`;
      const result = await this.model.generateContent(prompt);
      const content = result.response.candidates?.[0].content.parts[0].text || '';
      return { content, wordCount: content.split(' ').length };
    } catch (error) {
      return { content: "", wordCount: 0 };
    }
  }

  async startVoiceConversation(userId: string, sessionId: string, userName: string, memories: any[], imageContext?: string): Promise<{ agentId: string; conversationId: string; wsUrl?: string }> {
    try {
      let agentGoal = "Ask about their childhood.";
      if (process.env.GOOGLE_CLOUD_PROJECT && (memories.length > 0 || imageContext)) {
        try {
          // The Architect / Director Persona
          const planPrompt = `
                You are the Director of a biography project. Subject: ${userName}.
                Memories: ${JSON.stringify(memories.slice(0, 5))}
                ${imageContext ? `TRIGGER: User uploaded a photo: ${imageContext}` : ''}

                Define the session goal.
                ${imageContext ? 'GOAL: Explore the story behind the photo.' : 'GOAL: Explore a specific memory in depth.'}
                Keep it under 30 words.
             `;
          const result = await this.model.generateContent(planPrompt);
          const plan = result.response.candidates?.[0].content.parts[0].text;
          if (plan) agentGoal = plan.trim();
        } catch (e) { console.warn("Failed to generate goal"); }
      }

      console.log(`[Director] Session Goal: ${agentGoal}`);

      return await this.retry(async () => {
        if (!process.env.ELEVENLABS_API_KEY) {
          return { agentId: "mock-agent", conversationId: "mock-conv-id" };
        }
        // ElevenLabs Agent with Dynamic Prompt Injection
        const conversation = await (this.elevenLabs as any).conversationalAi.createConversation({
          agent_id: process.env.ELEVENLABS_AGENT_ID!,
          conversation_config_override: {
            agent: {
              prompt: {
                first_message: `Hi ${userName}, I'm Evermore. ${agentGoal}`
              }
            }
          },
          dynamic_variables: {
            user_name: userName,
            session_goal: agentGoal
          }
        });
        return { agentId: conversation.agent_id, conversationId: conversation.conversation_id };
      });
    } catch (error) {
      console.error("Failed to start voice conversation:", error);
      throw error;
    }
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<{ description: string; detectedEntities: string[]; conversationalTrigger?: string }> {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return {
          description: "Mock image analysis",
          detectedEntities: ["person", "tree"],
          conversationalTrigger: "That looks like a lovely garden. Who is with you in the photo?"
        };
      }

      const imagePart: Part = { inlineData: { data: imageBase64, mimeType: mimeType } };
      // The Proustian Prompt
      const prompt = `
            Analyze this image for a biography interview.
            1. Describe the scene and time period.
            2. List people/objects.
            3. Generate a 'Conversational Trigger' - a question to unlock the memory.
            Output JSON: { "description": "...", "entities": ["..."], "conversationalTrigger": "..." }
        `;

      const result = await this.visionModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }]
      });
      const text = result.response.candidates?.[0].content.parts[0].text;
      if (!text) throw new Error("No response from Vision");

      const jsonMatch = text.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1]);
        return {
          description: json.description,
          detectedEntities: json.entities || [],
          conversationalTrigger: json.conversationalTrigger
        };
      }
      return { description: text, detectedEntities: [], conversationalTrigger: "Tell me about this photo." };
    } catch (error) {
      console.error("Gemini Vision failed:", error);
      return { description: "Error", detectedEntities: [] };
    }
  }

  async generateSpeech(text: string, style?: string): Promise<Buffer> {
    try {
      if (!process.env.ELEVENLABS_API_KEY) return Buffer.from("mock-audio");
      // 'The Empath' Logic for TTS stability
      const stability = style === 'emotional' ? 0.35 : 0.7;
      const response = await this.elevenLabs.textToSpeech.convert(
        process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
        {
          text,
          model_id: 'eleven_turbo_v2_5', // Turbo for speed
          voice_settings: { stability, similarity_boost: 0.75 }
        } as any
      );
      const chunks: Buffer[] = [];
      for await (const chunk of (response as any)) { chunks.push(Buffer.from(chunk)); }
      return Buffer.concat(chunks);
    } catch (error) {
      return Buffer.from("");
    }
  }
}
