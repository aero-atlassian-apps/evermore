import { AIServicePort } from '../../../core/application/ports/AIServicePort';
import { GeminiService } from './GeminiService';

// Re-export GeminiService as CombinedAIService to maintain compatibility
// or simply delegate. For now, we extend GeminiService to satisfy the interface
// and class name expected by the rest of the app.
export class CombinedAIService extends GeminiService implements AIServicePort {}
