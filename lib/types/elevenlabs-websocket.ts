/**
 * ElevenLabs Conversational AI WebSocket Types
 * For real-time voice conversations with ElevenLabs agents
 */

// ============================================
// CLIENT → SERVER EVENTS
// ============================================

export interface ConversationInitData {
  type: 'conversation_initiation_client_data';
  conversation_config_override?: {
    agent?: {
      prompt?: { prompt: string };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
    };
  };
  dynamic_variables?: Record<string, string | number | boolean>;
  user_id?: string;
}

export interface UserAudioChunk {
  user_audio_chunk: string; // base64 encoded audio
}

export interface PongEvent {
  type: 'pong';
  event_id: number;
}

export interface ContextualUpdate {
  type: 'contextual_update';
  text: string;
}

export type ClientToServerEvent = 
  | ConversationInitData 
  | UserAudioChunk 
  | PongEvent 
  | ContextualUpdate;

// ============================================
// SERVER → CLIENT EVENTS
// ============================================

export interface PingEvent {
  type: 'ping';
  ping_event: {
    event_id: number;
    ping_ms: number;
  };
}

export interface ConversationInitMetadata {
  type: 'conversation_initiation_metadata';
  conversation_initiation_metadata_event: {
    conversation_id: string;
    agent_output_audio_format: string;
  };
}

export interface UserTranscriptEvent {
  type: 'user_transcript';
  user_transcription_event: {
    user_transcript: string;
  };
}

export interface AgentResponseEvent {
  type: 'agent_response';
  agent_response_event: {
    agent_response: string;
  };
}

export interface AgentResponseCorrectionEvent {
  type: 'agent_response_correction';
  agent_response_correction_event: {
    corrected_agent_response: string;
  };
}

export interface AudioEvent {
  type: 'audio';
  audio_event: {
    audio_base_64: string;
    event_id: number;
  };
}

export interface InterruptionEvent {
  type: 'interruption';
  interruption_event: {
    event_id: number;
  };
}

export interface InternalVadEvent {
  type: 'internal_vad';
  internal_vad_event: {
    type: 'speech_start' | 'speech_end';
  };
}

export interface ConversationEndedEvent {
  type: 'conversation_ended';
}

export type ServerToClientEvent =
  | PingEvent
  | ConversationInitMetadata
  | UserTranscriptEvent
  | AgentResponseEvent
  | AgentResponseCorrectionEvent
  | AudioEvent
  | InterruptionEvent
  | InternalVadEvent
  | ConversationEndedEvent;

// ============================================
// STATE TYPES
// ============================================

export interface TranscriptEntry {
  speaker: 'agent' | 'user';
  text: string;
  timestamp: string;
}

export interface WarmUpPhaseResult {
  transcript: TranscriptEntry[];
  extractedTopic: string | null;
  durationSeconds: number;
  conversationId: string;
}

export type ConversationPhase = 'idle' | 'connecting' | 'active' | 'ready_to_transition' | 'ended';

export interface ElevenLabsConversationState {
  phase: ConversationPhase;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: TranscriptEntry[];
  conversationId: string | null;
  error: string | null;
}
