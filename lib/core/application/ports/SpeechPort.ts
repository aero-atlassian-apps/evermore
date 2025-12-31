export interface SpeechSegment {
  text: string;
  confidence: number;
  speakerId: string;
  startTime: number;
  endTime: number;
}

export interface SpeechToTextResult {
  text: string; // Full transcript
  confidence: number; // Overall confidence
  segments: SpeechSegment[]; // Granular details
  language?: string;
  normalizedText?: string; // Added for STT normalization support
}

export interface SpeechOptions {
  emotion?: 'neutral' | 'happy' | 'sad' | 'anxious' | 'excited' | 'empathetic';
  speed?: number; // 0.5 to 2.0
  voiceId?: string;
  style?: string; // Legacy support or specific model styles
}

export interface SpeechPort {
  textToSpeech(text: string, options?: SpeechOptions): Promise<Buffer>;
  speechToText(audioBuffer: Buffer, contentType: string): Promise<SpeechToTextResult>;
}
