/**
 * Empathy Engine - Emotional Intelligence for Senior Companion.
 * 
 * Provides emotional awareness and empathetic response generation:
 * - Emotion detection from text and voice indicators
 * - Empathetic response patterns
 * - Active listening behaviors
 * - Comfort and validation strategies
 * 
 * @module EmpathyEngine
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Detected emotion categories.
 */
export enum EmotionCategory {
    JOY = 'JOY',
    SADNESS = 'SADNESS',
    ANGER = 'ANGER',
    FEAR = 'FEAR',
    SURPRISE = 'SURPRISE',
    DISGUST = 'DISGUST',
    TRUST = 'TRUST',
    ANTICIPATION = 'ANTICIPATION',
    LONELINESS = 'LONELINESS',
    CONFUSION = 'CONFUSION',
    ANXIETY = 'ANXIETY',
    CONTENTMENT = 'CONTENTMENT',
    NOSTALGIA = 'NOSTALGIA',
    GRIEF = 'GRIEF',
    NEUTRAL = 'NEUTRAL',
}

/**
 * Emotional intensity levels.
 */
export enum EmotionIntensity {
    VERY_LOW = 1,
    LOW = 2,
    MODERATE = 3,
    HIGH = 4,
    VERY_HIGH = 5,
}

/**
 * Voice prosody indicators.
 */
export interface VoiceProsody {
    /** Speaking rate (words per minute) */
    speakingRate: number;
    /** Pitch variation (low = monotone, high = animated) */
    pitchVariation: number;
    /** Volume level (0-1) */
    volume: number;
    /** Pause frequency */
    pauseFrequency: number;
    /** Voice tremor detected */
    hasTremor: boolean;
    /** Sighing detected */
    hasSighing: boolean;
    /** Crying detected */
    hasCrying: boolean;
    /** Laughter detected */
    hasLaughter: boolean;
}

/**
 * Detected emotional state.
 */
export interface EmotionalState {
    /** Primary emotion */
    primaryEmotion: EmotionCategory;
    /** Secondary emotion (if present) */
    secondaryEmotion?: EmotionCategory;
    /** Intensity of primary emotion */
    intensity: EmotionIntensity;
    /** Confidence in detection (0-1) */
    confidence: number;
    /** Valence (-1 to 1, negative to positive) */
    valence: number;
    /** Arousal level (0-1, calm to excited) */
    arousal: number;
    /** Detected triggers/causes */
    triggers: string[];
    /** Whether emotional support is needed */
    needsSupport: boolean;
    /** Whether escalation is recommended */
    recommendEscalation: boolean;
    /** Raw analysis data */
    analysisDetails: EmotionAnalysisDetails;
}

/**
 * Detailed analysis data.
 */
export interface EmotionAnalysisDetails {
    /** Text-based signals */
    textSignals: TextEmotionSignal[];
    /** Voice-based signals (if available) */
    voiceSignals?: VoiceEmotionSignal[];
    /** Combined weighted score */
    combinedScore: number;
    /** Analysis timestamp */
    timestamp: number;
}

/**
 * Text-based emotion signal.
 */
export interface TextEmotionSignal {
    /** The text fragment */
    text: string;
    /** Detected emotion */
    emotion: EmotionCategory;
    /** Signal strength (0-1) */
    strength: number;
    /** Type of signal */
    signalType: 'keyword' | 'phrase' | 'pattern' | 'sentiment' | 'context';
}

/**
 * Voice-based emotion signal.
 */
export interface VoiceEmotionSignal {
    /** Signal type */
    type: 'prosody' | 'acoustic' | 'paralinguistic';
    /** Detected emotion */
    emotion: EmotionCategory;
    /** Signal strength (0-1) */
    strength: number;
    /** Description */
    description: string;
}

/**
 * Empathetic response configuration.
 */
export interface EmpatheticResponse {
    /** Response type */
    type: EmpathyResponseType;
    /** The response text */
    text: string;
    /** Suggested follow-up */
    followUp?: string;
    /** Tone adjustment */
    tone: ResponseTone;
    /** Speaking pace adjustment */
    paceMultiplier: number;
    /** Whether to add pauses */
    addPauses: boolean;
    /** Suggested actions */
    suggestedActions: string[];
}

/**
 * Types of empathetic responses.
 */
export enum EmpathyResponseType {
    /** Acknowledge the emotion */
    ACKNOWLEDGMENT = 'ACKNOWLEDGMENT',
    /** Validate feelings */
    VALIDATION = 'VALIDATION',
    /** Active listening reflection */
    REFLECTION = 'REFLECTION',
    /** Offer comfort */
    COMFORT = 'COMFORT',
    /** Gentle encouragement */
    ENCOURAGEMENT = 'ENCOURAGEMENT',
    /** Redirect to positive */
    REDIRECTION = 'REDIRECTION',
    /** Share understanding */
    EMPATHY_STATEMENT = 'EMPATHY_STATEMENT',
    /** Ask caring follow-up */
    CARING_INQUIRY = 'CARING_INQUIRY',
    /** Celebrate with them */
    CELEBRATION = 'CELEBRATION',
    /** Express concern */
    CONCERN = 'CONCERN',
}

/**
 * Response tone settings.
 */
export enum ResponseTone {
    WARM = 'WARM',
    GENTLE = 'GENTLE',
    SUPPORTIVE = 'SUPPORTIVE',
    CHEERFUL = 'CHEERFUL',
    CALM = 'CALM',
    SERIOUS = 'SERIOUS',
    COMPASSIONATE = 'COMPASSIONATE',
    ENCOURAGING = 'ENCOURAGING',
}

// ============================================================================
// Emotion Lexicons
// ============================================================================

/**
 * Emotion keyword patterns for detection.
 */
const EMOTION_LEXICON: Record<EmotionCategory, { keywords: string[]; phrases: string[] }> = {
    [EmotionCategory.JOY]: {
        keywords: ['happy', 'wonderful', 'great', 'fantastic', 'lovely', 'blessed', 'grateful', 'delighted', 'pleased', 'thrilled', 'excited', 'joyful'],
        phrases: ['so happy', 'feeling good', 'great day', 'wonderful time', 'best day', 'makes me smile', 'love it', 'so glad'],
    },
    [EmotionCategory.SADNESS]: {
        keywords: ['sad', 'unhappy', 'depressed', 'down', 'miserable', 'heartbroken', 'disappointed', 'upset', 'tearful', 'crying', 'devastated'],
        phrases: ['feeling blue', 'miss them', 'so sad', 'breaks my heart', 'tears in my eyes', 'not feeling well', 'hard time', 'struggling'],
    },
    [EmotionCategory.LONELINESS]: {
        keywords: ['lonely', 'alone', 'isolated', 'forgotten', 'abandoned', 'nobody', 'empty'],
        phrases: ['no one calls', 'all alone', 'nobody visits', 'miss my', 'wish someone', 'no one understands', 'feel invisible', 'no friends'],
    },
    [EmotionCategory.ANXIETY]: {
        keywords: ['worried', 'anxious', 'nervous', 'stressed', 'afraid', 'scared', 'uneasy', 'tense', 'panicked', 'overwhelmed'],
        phrases: ['can\'t stop thinking', 'what if', 'keeps me up', 'worried about', 'so stressed', 'on edge', 'nervous about'],
    },
    [EmotionCategory.FEAR]: {
        keywords: ['scared', 'frightened', 'terrified', 'fearful', 'panicked', 'alarmed', 'horrified'],
        phrases: ['scares me', 'afraid of', 'terrified of', 'don\'t feel safe', 'frightening'],
    },
    [EmotionCategory.ANGER]: {
        keywords: ['angry', 'furious', 'mad', 'irritated', 'frustrated', 'annoyed', 'outraged', 'resentful', 'bitter'],
        phrases: ['makes me mad', 'so angry', 'can\'t believe', 'how dare', 'not fair', 'sick of', 'fed up'],
    },
    [EmotionCategory.CONFUSION]: {
        keywords: ['confused', 'lost', 'puzzled', 'bewildered', 'unsure', 'uncertain', 'disoriented'],
        phrases: ['don\'t understand', 'what do you mean', 'I\'m lost', 'confused about', 'makes no sense', 'can\'t remember'],
    },
    [EmotionCategory.GRIEF]: {
        keywords: ['grieving', 'mourning', 'bereaved', 'loss', 'passed', 'died', 'gone', 'death'],
        phrases: ['passed away', 'miss them so much', 'since they died', 'gone forever', 'never see them again', 'losing them'],
    },
    [EmotionCategory.NOSTALGIA]: {
        keywords: ['remember', 'memories', 'reminisce', 'nostalgic', 'old days', 'back then', 'used to'],
        phrases: ['good old days', 'I remember when', 'back in my day', 'those were the times', 'how things used to be'],
    },
    [EmotionCategory.CONTENTMENT]: {
        keywords: ['content', 'peaceful', 'calm', 'satisfied', 'relaxed', 'comfortable', 'at ease'],
        phrases: ['feeling at peace', 'nice and calm', 'quite content', 'all is well', 'feeling good'],
    },
    [EmotionCategory.TRUST]: {
        keywords: ['trust', 'believe', 'faith', 'reliable', 'honest', 'safe'],
        phrases: ['I trust you', 'can count on', 'believe in'],
    },
    [EmotionCategory.ANTICIPATION]: {
        keywords: ['looking forward', 'excited', 'anticipating', 'expecting', 'hopeful', 'eager'],
        phrases: ['can\'t wait', 'looking forward to', 'excited about', 'hope to'],
    },
    [EmotionCategory.SURPRISE]: {
        keywords: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'wow'],
        phrases: ['didn\'t expect', 'what a surprise', 'can\'t believe it', 'never thought'],
    },
    [EmotionCategory.DISGUST]: {
        keywords: ['disgusted', 'revolting', 'terrible', 'awful', 'horrible', 'gross'],
        phrases: ['makes me sick', 'can\'t stand', 'so disgusting'],
    },
    [EmotionCategory.NEUTRAL]: {
        keywords: [],
        phrases: [],
    },
};

/**
 * Empathetic response templates by emotion.
 */
const EMPATHY_TEMPLATES: Record<EmotionCategory, { responses: string[]; followUps: string[] }> = {
    [EmotionCategory.SADNESS]: {
        responses: [
            "I can hear that you're going through a difficult time, and I want you to know I'm here for you.",
            "That sounds really hard. It's okay to feel sad about this.",
            "I'm sorry you're feeling this way. Your feelings are completely valid.",
            "It takes courage to share how you're really feeling. I'm listening.",
        ],
        followUps: [
            "Would you like to tell me more about what's on your mind?",
            "Is there something specific that's weighing on you?",
            "Sometimes it helps to talk things through. I'm here if you want to share.",
        ],
    },
    [EmotionCategory.LONELINESS]: {
        responses: [
            "I understand that feeling of loneliness can be really painful. I'm glad you're talking to me.",
            "You matter, and I'm here with you right now.",
            "Feeling alone is so hard. I want you to know you're not truly alone.",
            "I hear you, and I care about how you're feeling.",
        ],
        followUps: [
            "When do you find yourself feeling most lonely?",
            "Is there someone you've been missing lately?",
            "Would you like to talk about some happy memories together?",
        ],
    },
    [EmotionCategory.ANXIETY]: {
        responses: [
            "It sounds like you have a lot on your mind. That can feel overwhelming.",
            "Worrying about things is natural, but I don't want it to weigh too heavily on you.",
            "I can tell this is causing you stress. Let's take a moment together.",
            "Your concerns are understandable. Let's talk through what's worrying you.",
        ],
        followUps: [
            "Would it help to talk about what's making you anxious?",
            "Sometimes naming our worries makes them feel smaller. What's on your mind?",
            "Is there anything I can help you think through?",
        ],
    },
    [EmotionCategory.JOY]: {
        responses: [
            "That's wonderful to hear! Your happiness makes me happy too.",
            "What a lovely thing to share! I can hear the joy in your words.",
            "That sounds absolutely delightful! Tell me more!",
            "It's so nice to hear good news. I'm smiling along with you.",
        ],
        followUps: [
            "What made this moment so special for you?",
            "I'd love to hear more about what brought you such joy.",
            "This sounds like a memory worth treasuring!",
        ],
    },
    [EmotionCategory.GRIEF]: {
        responses: [
            "Losing someone we love is one of the hardest things we face. I'm so sorry for your loss.",
            "Grief is love with nowhere to go. It's okay to feel this deeply.",
            "There's no timeline for grief. Take all the time you need.",
            "The people we love never truly leave us. They live on in our hearts and memories.",
        ],
        followUps: [
            "Would you like to share a favorite memory of them?",
            "What's something you especially loved about them?",
            "Sometimes talking about our loved ones helps keep their memory alive.",
        ],
    },
    [EmotionCategory.NOSTALGIA]: {
        responses: [
            "Those memories sound so precious. Thank you for sharing them with me.",
            "The past holds such beautiful moments. It's lovely to revisit them.",
            "What a wonderful time that must have been. I can almost picture it.",
            "Those were clearly meaningful times for you. I love hearing about them.",
        ],
        followUps: [
            "What else do you remember about that time?",
            "Were there other special moments from back then?",
            "Tell me more about what life was like then.",
        ],
    },
    [EmotionCategory.CONFUSION]: {
        responses: [
            "I understand this might be confusing. Let me try to help clarify.",
            "That's completely okay. Sometimes things can be a bit unclear.",
            "No worries at all. Let's take this one step at a time together.",
            "I'm here to help make things clearer. What would help most?",
        ],
        followUps: [
            "What part would you like me to explain differently?",
            "Should I go through that again more slowly?",
            "Is there a specific part that's unclear?",
        ],
    },
    [EmotionCategory.ANGER]: {
        responses: [
            "I can understand why that would be frustrating. Your feelings make sense.",
            "That does sound upsetting. It's okay to feel angry about that.",
            "I hear your frustration. Sometimes things just aren't fair.",
            "That situation would make anyone upset. Your reaction is understandable.",
        ],
        followUps: [
            "Would you like to talk more about what happened?",
            "Is there anything that might help you feel better about this?",
            "Sometimes it helps to get these feelings out. I'm listening.",
        ],
    },
    [EmotionCategory.FEAR]: {
        responses: [
            "It's natural to feel afraid sometimes. You're not alone in this feeling.",
            "I want you to know you're safe talking to me about your fears.",
            "Fear is our mind's way of protecting us. What you're feeling is valid.",
            "That sounds frightening. I understand why you'd feel that way.",
        ],
        followUps: [
            "What would help you feel safer right now?",
            "Would you like to talk about what's scaring you?",
            "Is there someone I can help you contact?",
        ],
    },
    [EmotionCategory.CONTENTMENT]: {
        responses: [
            "It's so nice to hear you're feeling at peace. You deserve these calm moments.",
            "That contentment comes through in your words. How lovely.",
            "What a peaceful state of mind. I'm glad you're feeling this way.",
        ],
        followUps: [
            "What's contributing to this peaceful feeling?",
            "I hope you can hold onto this contentment.",
        ],
    },
    [EmotionCategory.TRUST]: {
        responses: [
            "Thank you for trusting me. That means a lot.",
            "I value your trust and will always do my best to help.",
        ],
        followUps: [],
    },
    [EmotionCategory.ANTICIPATION]: {
        responses: [
            "How exciting! I love hearing about things you're looking forward to.",
            "That sounds like something wonderful to anticipate!",
        ],
        followUps: [
            "Tell me more about what you're looking forward to!",
        ],
    },
    [EmotionCategory.SURPRISE]: {
        responses: [
            "What a surprise! Life can be full of unexpected moments.",
            "That sounds quite unexpected! How are you feeling about it?",
        ],
        followUps: [
            "Was it a good surprise?",
        ],
    },
    [EmotionCategory.DISGUST]: {
        responses: [
            "I understand that's not a pleasant situation.",
            "That sounds quite unpleasant. I'm sorry you had to deal with that.",
        ],
        followUps: [],
    },
    [EmotionCategory.NEUTRAL]: {
        responses: [
            "I'm here and listening.",
            "Please go on, I'm following along.",
        ],
        followUps: [],
    },
};

// ============================================================================
// Empathy Engine Class
// ============================================================================

/**
 * Configuration for the empathy engine.
 */
export interface EmpathyEngineConfig {
    /** Minimum confidence for emotion detection */
    minConfidence: number;
    /** Whether to use voice analysis */
    enableVoiceAnalysis: boolean;
    /** Default response tone */
    defaultTone: ResponseTone;
    /** Escalation threshold intensity */
    escalationThreshold: EmotionIntensity;
    /** High-risk emotions that need extra care */
    highRiskEmotions: EmotionCategory[];
}

const DEFAULT_CONFIG: EmpathyEngineConfig = {
    minConfidence: 0.3,
    enableVoiceAnalysis: true,
    defaultTone: ResponseTone.WARM,
    escalationThreshold: EmotionIntensity.VERY_HIGH,
    highRiskEmotions: [
        EmotionCategory.LONELINESS,
        EmotionCategory.GRIEF,
        EmotionCategory.FEAR,
    ],
};

/**
 * Empathy Engine - Provides emotional intelligence for the companion.
 * 
 * Usage:
 * ```typescript
 * const empathy = new EmpathyEngine();
 * 
 * // Detect emotion from user input
 * const state = empathy.detectEmotion("I've been feeling so lonely lately");
 * // => { primaryEmotion: LONELINESS, intensity: HIGH, needsSupport: true, ... }
 * 
 * // Generate empathetic response
 * const response = empathy.generateResponse(state);
 * // => { text: "Feeling alone is so hard...", type: VALIDATION, ... }
 * 
 * // Adapt response to emotional context
 * const adaptedAnswer = empathy.adaptResponse("Here's what I found...", state);
 * ```
 */
export class EmpathyEngine {
    private config: EmpathyEngineConfig;
    private emotionHistory: EmotionalState[] = [];

    constructor(config?: Partial<EmpathyEngineConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================================================
    // Emotion Detection
    // ============================================================================

    /**
     * Detect emotional state from text input.
     */
    detectEmotion(text: string, voiceProsody?: VoiceProsody): EmotionalState {
        const textSignals = this.analyzeText(text);
        const voiceSignals = voiceProsody ? this.analyzeVoice(voiceProsody) : undefined;

        // Combine signals to determine emotional state
        const combinedAnalysis = this.combineSignals(textSignals, voiceSignals);

        const state: EmotionalState = {
            primaryEmotion: combinedAnalysis.primaryEmotion,
            secondaryEmotion: combinedAnalysis.secondaryEmotion,
            intensity: combinedAnalysis.intensity,
            confidence: combinedAnalysis.confidence,
            valence: this.calculateValence(combinedAnalysis.primaryEmotion),
            arousal: this.calculateArousal(combinedAnalysis.primaryEmotion, combinedAnalysis.intensity),
            triggers: this.extractTriggers(text, combinedAnalysis.primaryEmotion),
            needsSupport: this.needsEmotionalSupport(combinedAnalysis),
            recommendEscalation: this.shouldEscalate(combinedAnalysis),
            analysisDetails: {
                textSignals,
                voiceSignals,
                combinedScore: combinedAnalysis.score,
                timestamp: Date.now(),
            },
        };

        // Track emotion history
        this.emotionHistory.push(state);
        if (this.emotionHistory.length > 50) {
            this.emotionHistory = this.emotionHistory.slice(-25);
        }

        return state;
    }

    /**
     * Analyze text for emotion signals.
     */
    private analyzeText(text: string): TextEmotionSignal[] {
        const signals: TextEmotionSignal[] = [];
        const lowerText = text.toLowerCase();

        // Check each emotion category
        for (const [emotion, lexicon] of Object.entries(EMOTION_LEXICON)) {
            const emotionCategory = emotion as EmotionCategory;

            // Check keywords
            for (const keyword of lexicon.keywords) {
                if (lowerText.includes(keyword)) {
                    signals.push({
                        text: keyword,
                        emotion: emotionCategory,
                        strength: 0.6,
                        signalType: 'keyword',
                    });
                }
            }

            // Check phrases (stronger signal)
            for (const phrase of lexicon.phrases) {
                if (lowerText.includes(phrase)) {
                    signals.push({
                        text: phrase,
                        emotion: emotionCategory,
                        strength: 0.8,
                        signalType: 'phrase',
                    });
                }
            }
        }

        // Check for intensifiers
        const intensifiers = ['very', 'so', 'really', 'extremely', 'incredibly', 'absolutely'];
        for (const intensifier of intensifiers) {
            if (lowerText.includes(intensifier)) {
                // Boost all detected signals
                for (const signal of signals) {
                    signal.strength = Math.min(1.0, signal.strength + 0.15);
                }
                break;
            }
        }

        // Check for negation (can flip emotion)
        const negations = ["don't", "not", "never", "no longer", "can't", "won't"];
        for (const negation of negations) {
            if (lowerText.includes(negation)) {
                // Some signals might need to be flipped
                for (const signal of signals) {
                    if (signal.emotion === EmotionCategory.JOY) {
                        signal.emotion = EmotionCategory.SADNESS;
                        signal.signalType = 'pattern';
                    }
                }
                break;
            }
        }

        return signals;
    }

    /**
     * Analyze voice prosody for emotion signals.
     */
    private analyzeVoice(prosody: VoiceProsody): VoiceEmotionSignal[] {
        const signals: VoiceEmotionSignal[] = [];

        // Low speaking rate + low pitch variation = sadness/depression
        if (prosody.speakingRate < 100 && prosody.pitchVariation < 0.3) {
            signals.push({
                type: 'prosody',
                emotion: EmotionCategory.SADNESS,
                strength: 0.7,
                description: 'Slow, monotone speech',
            });
        }

        // High speaking rate + high pitch variation = anxiety/excitement
        if (prosody.speakingRate > 180 && prosody.pitchVariation > 0.6) {
            signals.push({
                type: 'prosody',
                emotion: EmotionCategory.ANXIETY,
                strength: 0.6,
                description: 'Fast, variable speech',
            });
        }

        // Voice tremor = fear/anxiety
        if (prosody.hasTremor) {
            signals.push({
                type: 'acoustic',
                emotion: EmotionCategory.FEAR,
                strength: 0.8,
                description: 'Voice tremor detected',
            });
        }

        // Crying = sadness/grief
        if (prosody.hasCrying) {
            signals.push({
                type: 'paralinguistic',
                emotion: EmotionCategory.GRIEF,
                strength: 0.9,
                description: 'Crying detected',
            });
        }

        // Sighing = sadness/loneliness
        if (prosody.hasSighing) {
            signals.push({
                type: 'paralinguistic',
                emotion: EmotionCategory.LONELINESS,
                strength: 0.5,
                description: 'Sighing detected',
            });
        }

        // Laughter = joy
        if (prosody.hasLaughter) {
            signals.push({
                type: 'paralinguistic',
                emotion: EmotionCategory.JOY,
                strength: 0.8,
                description: 'Laughter detected',
            });
        }

        // Low volume = possible depression/sadness
        if (prosody.volume < 0.3) {
            signals.push({
                type: 'acoustic',
                emotion: EmotionCategory.SADNESS,
                strength: 0.4,
                description: 'Low volume speech',
            });
        }

        return signals;
    }

    /**
     * Combine text and voice signals into overall analysis.
     */
    private combineSignals(
        textSignals: TextEmotionSignal[],
        voiceSignals?: VoiceEmotionSignal[]
    ): {
        primaryEmotion: EmotionCategory;
        secondaryEmotion?: EmotionCategory;
        intensity: EmotionIntensity;
        confidence: number;
        score: number;
    } {
        const emotionScores = new Map<EmotionCategory, number>();

        // Weight text signals
        for (const signal of textSignals) {
            const current = emotionScores.get(signal.emotion) || 0;
            emotionScores.set(signal.emotion, current + signal.strength);
        }

        // Weight voice signals (slightly higher weight as they're harder to fake)
        if (voiceSignals) {
            for (const signal of voiceSignals) {
                const current = emotionScores.get(signal.emotion) || 0;
                emotionScores.set(signal.emotion, current + signal.strength * 1.2);
            }
        }

        // Find top emotions
        const sorted = Array.from(emotionScores.entries()).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            return {
                primaryEmotion: EmotionCategory.NEUTRAL,
                intensity: EmotionIntensity.LOW,
                confidence: 0.5,
                score: 0,
            };
        }

        const [primary, primaryScore] = sorted[0];
        const secondary = sorted.length > 1 && sorted[1][1] > 0.5 ? sorted[1][0] : undefined;

        // Calculate intensity based on score
        let intensity: EmotionIntensity;
        if (primaryScore >= 2.5) {
            intensity = EmotionIntensity.VERY_HIGH;
        } else if (primaryScore >= 1.8) {
            intensity = EmotionIntensity.HIGH;
        } else if (primaryScore >= 1.2) {
            intensity = EmotionIntensity.MODERATE;
        } else if (primaryScore >= 0.6) {
            intensity = EmotionIntensity.LOW;
        } else {
            intensity = EmotionIntensity.VERY_LOW;
        }

        // Confidence based on signal agreement
        const totalSignals = textSignals.length + (voiceSignals?.length || 0);
        const confidence = totalSignals > 0 ? Math.min(1, primaryScore / (totalSignals * 0.5)) : 0.3;

        return {
            primaryEmotion: primary,
            secondaryEmotion: secondary,
            intensity,
            confidence,
            score: primaryScore,
        };
    }

    /**
     * Calculate emotional valence (negative to positive).
     */
    private calculateValence(emotion: EmotionCategory): number {
        const valenceMap: Record<EmotionCategory, number> = {
            [EmotionCategory.JOY]: 0.9,
            [EmotionCategory.CONTENTMENT]: 0.7,
            [EmotionCategory.TRUST]: 0.6,
            [EmotionCategory.ANTICIPATION]: 0.5,
            [EmotionCategory.SURPRISE]: 0.2,
            [EmotionCategory.NOSTALGIA]: 0.1,
            [EmotionCategory.NEUTRAL]: 0,
            [EmotionCategory.CONFUSION]: -0.2,
            [EmotionCategory.ANXIETY]: -0.5,
            [EmotionCategory.LONELINESS]: -0.6,
            [EmotionCategory.SADNESS]: -0.7,
            [EmotionCategory.FEAR]: -0.7,
            [EmotionCategory.ANGER]: -0.6,
            [EmotionCategory.DISGUST]: -0.5,
            [EmotionCategory.GRIEF]: -0.9,
        };
        return valenceMap[emotion] ?? 0;
    }

    /**
     * Calculate emotional arousal level.
     */
    private calculateArousal(emotion: EmotionCategory, intensity: EmotionIntensity): number {
        const baseArousal: Record<EmotionCategory, number> = {
            [EmotionCategory.FEAR]: 0.9,
            [EmotionCategory.ANGER]: 0.8,
            [EmotionCategory.JOY]: 0.7,
            [EmotionCategory.ANXIETY]: 0.7,
            [EmotionCategory.SURPRISE]: 0.7,
            [EmotionCategory.ANTICIPATION]: 0.5,
            [EmotionCategory.LONELINESS]: 0.3,
            [EmotionCategory.SADNESS]: 0.3,
            [EmotionCategory.GRIEF]: 0.4,
            [EmotionCategory.NOSTALGIA]: 0.3,
            [EmotionCategory.CONTENTMENT]: 0.2,
            [EmotionCategory.NEUTRAL]: 0.1,
            [EmotionCategory.TRUST]: 0.3,
            [EmotionCategory.CONFUSION]: 0.4,
            [EmotionCategory.DISGUST]: 0.5,
        };

        const base = baseArousal[emotion] ?? 0.3;
        const intensityMultiplier = intensity / 5;
        return Math.min(1, base * (0.5 + intensityMultiplier * 0.5));
    }

    /**
     * Extract potential triggers from text.
     */
    private extractTriggers(text: string, emotion: EmotionCategory): string[] {
        const triggers: string[] = [];

        // Look for people mentions
        const peoplePatterns = /\b(my|the)\s+(wife|husband|mother|father|mom|dad|son|daughter|grandchild|friend|neighbor|doctor)\b/gi;
        const peopleMatches = text.match(peoplePatterns);
        if (peopleMatches) triggers.push(...peopleMatches);

        // Look for event mentions
        const eventPatterns = /\b(birthday|anniversary|holiday|christmas|thanksgiving|funeral|hospital|visit)\b/gi;
        const eventMatches = text.match(eventPatterns);
        if (eventMatches) triggers.push(...eventMatches);

        // Look for health mentions
        const healthPatterns = /\b(pain|ache|sick|illness|medication|doctor|surgery|hospital|diagnosis)\b/gi;
        const healthMatches = text.match(healthPatterns);
        if (healthMatches) triggers.push(...healthMatches);

        return [...new Set(triggers)].slice(0, 5);
    }

    /**
     * Determine if emotional support is needed.
     */
    private needsEmotionalSupport(analysis: {
        primaryEmotion: EmotionCategory;
        intensity: EmotionIntensity;
        confidence: number;
    }): boolean {
        const needsSupportEmotions = [
            EmotionCategory.SADNESS,
            EmotionCategory.LONELINESS,
            EmotionCategory.GRIEF,
            EmotionCategory.FEAR,
            EmotionCategory.ANXIETY,
        ];

        return (
            needsSupportEmotions.includes(analysis.primaryEmotion) &&
            analysis.intensity >= EmotionIntensity.MODERATE &&
            analysis.confidence >= this.config.minConfidence
        );
    }

    /**
     * Determine if escalation is recommended.
     */
    private shouldEscalate(analysis: {
        primaryEmotion: EmotionCategory;
        intensity: EmotionIntensity;
    }): boolean {
        return (
            this.config.highRiskEmotions.includes(analysis.primaryEmotion) &&
            analysis.intensity >= this.config.escalationThreshold
        );
    }

    // ============================================================================
    // Response Generation
    // ============================================================================

    /**
     * Generate an empathetic response for the emotional state.
     */
    generateResponse(state: EmotionalState): EmpatheticResponse {
        const templates = EMPATHY_TEMPLATES[state.primaryEmotion];

        // Select appropriate response type based on intensity
        let responseType: EmpathyResponseType;
        if (state.intensity >= EmotionIntensity.HIGH) {
            responseType = state.valence < 0 ? EmpathyResponseType.COMFORT : EmpathyResponseType.CELEBRATION;
        } else if (state.needsSupport) {
            responseType = EmpathyResponseType.VALIDATION;
        } else if (state.valence < 0) {
            responseType = EmpathyResponseType.ACKNOWLEDGMENT;
        } else {
            responseType = EmpathyResponseType.EMPATHY_STATEMENT;
        }

        // Select response text
        const responseIndex = Math.floor(Math.random() * templates.responses.length);
        const text = templates.responses[responseIndex] || "I'm here with you.";

        // Select follow-up if available
        const followUp = templates.followUps.length > 0
            ? templates.followUps[Math.floor(Math.random() * templates.followUps.length)]
            : undefined;

        // Determine tone
        let tone: ResponseTone;
        if (state.primaryEmotion === EmotionCategory.GRIEF) {
            tone = ResponseTone.COMPASSIONATE;
        } else if (state.primaryEmotion === EmotionCategory.JOY) {
            tone = ResponseTone.CHEERFUL;
        } else if (state.valence < -0.5) {
            tone = ResponseTone.GENTLE;
        } else {
            tone = this.config.defaultTone;
        }

        // Pace adjustment (slower for sad emotions)
        const paceMultiplier = state.valence < 0 ? 0.85 : 1.0;

        // Add pauses for emotional moments
        const addPauses = state.intensity >= EmotionIntensity.MODERATE;

        // Suggested actions
        const suggestedActions: string[] = [];
        if (state.recommendEscalation) {
            suggestedActions.push('Consider notifying caregiver');
        }
        if (state.needsSupport && state.intensity >= EmotionIntensity.HIGH) {
            suggestedActions.push('Extended comfort mode recommended');
        }

        return {
            type: responseType,
            text,
            followUp,
            tone,
            paceMultiplier,
            addPauses,
            suggestedActions,
        };
    }

    /**
     * Adapt a response to the emotional context.
     */
    adaptResponse(originalResponse: string, state: EmotionalState): string {
        // If user needs support, prepend acknowledgment
        if (state.needsSupport && state.confidence >= this.config.minConfidence) {
            const empathyResponse = this.generateResponse(state);
            return `${empathyResponse.text}\n\n${originalResponse}`;
        }

        // For positive emotions, add affirmation
        if (state.valence > 0.5 && state.intensity >= EmotionIntensity.MODERATE) {
            return `${originalResponse}\n\nIt's wonderful to hear you're feeling good!`;
        }

        return originalResponse;
    }

    // ============================================================================
    // Emotion History Analysis
    // ============================================================================

    /**
     * Get recent emotion trend.
     */
    getEmotionTrend(windowSize: number = 5): {
        trend: 'improving' | 'declining' | 'stable';
        averageValence: number;
        dominantEmotion: EmotionCategory;
    } {
        const recent = this.emotionHistory.slice(-windowSize);
        if (recent.length < 2) {
            return {
                trend: 'stable',
                averageValence: 0,
                dominantEmotion: EmotionCategory.NEUTRAL,
            };
        }

        const valences = recent.map((s) => s.valence);
        const averageValence = valences.reduce((a, b) => a + b, 0) / valences.length;

        // Calculate trend
        const firstHalf = valences.slice(0, Math.floor(valences.length / 2));
        const secondHalf = valences.slice(Math.floor(valences.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        let trend: 'improving' | 'declining' | 'stable';
        if (secondAvg - firstAvg > 0.15) {
            trend = 'improving';
        } else if (firstAvg - secondAvg > 0.15) {
            trend = 'declining';
        } else {
            trend = 'stable';
        }

        // Find dominant emotion
        const emotionCounts = new Map<EmotionCategory, number>();
        for (const state of recent) {
            emotionCounts.set(state.primaryEmotion, (emotionCounts.get(state.primaryEmotion) || 0) + 1);
        }
        const dominantEmotion = Array.from(emotionCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || EmotionCategory.NEUTRAL;

        return { trend, averageValence, dominantEmotion };
    }

    /**
     * Check if user has been consistently emotional.
     */
    isEmotionallyConsistent(emotion: EmotionCategory, windowSize: number = 3): boolean {
        const recent = this.emotionHistory.slice(-windowSize);
        if (recent.length < windowSize) return false;

        return recent.every((s) => s.primaryEmotion === emotion);
    }

    /**
     * Get emotion history.
     */
    getHistory(): EmotionalState[] {
        return [...this.emotionHistory];
    }

    /**
     * Clear emotion history.
     */
    clearHistory(): void {
        this.emotionHistory = [];
    }
}
