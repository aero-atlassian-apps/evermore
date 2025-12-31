/**
 * Persona Manager - Long-term persona consistency and user preference learning.
 * 
 * Manages the companion's persona and adapts to user preferences:
 * - Warmth and patience settings
 * - Speaking style preferences
 * - Topic interest tracking
 * - Cultural sensitivity
 * - Relationship depth over time
 * 
 * @module PersonaManager
 */

import { EmotionCategory, EmotionalState } from './EmpathyEngine';

// ============================================================================
// Types
// ============================================================================

/**
 * Persona characteristics.
 */
export interface PersonaSettings {
    /** Warmth level (1-10) */
    warmthLevel: number;
    /** Patience factor (1-10, higher = more patient with repetition) */
    patienceLevel: number;
    /** Speaking pace preference (0.5-1.5, multiplier) */
    speakingPace: number;
    /** Formality level (1-10, 1=casual, 10=formal) */
    formalityLevel: number;
    /** Humor tolerance (1-10, willingness to use humor) */
    humorLevel: number;
    /** Verbosity preference (1-10, 1=concise, 10=elaborate) */
    verbosityLevel: number;
    /** Proactivity level (1-10, how often to initiate) */
    proactivityLevel: number;
    /** Emotional expressiveness (1-10) */
    expressivenessLevel: number;
}

/**
 * User preference profile.
 */
export interface UserPreferenceProfile {
    /** User ID */
    userId: string;
    /** Preferred name/nickname */
    preferredName: string;
    /** Preferred pronouns */
    pronouns: 'he/him' | 'she/her' | 'they/them' | 'other';
    /** Preferred greeting style */
    greetingStyle: 'formal' | 'casual' | 'affectionate';
    /** Preferred conversation length */
    preferredConversationLength: 'brief' | 'moderate' | 'extended';
    /** Topics of interest (weighted by engagement) */
    interests: TopicInterest[];
    /** Topics to avoid */
    avoidTopics: string[];
    /** Cultural background notes */
    culturalNotes: string[];
    /** Communication preferences */
    communicationPrefs: CommunicationPreferences;
    /** Learned over time */
    learnedPreferences: LearnedPreference[];
    /** Last updated */
    updatedAt: number;
}

/**
 * Topic of interest with engagement metrics.
 */
export interface TopicInterest {
    /** Topic name */
    topic: string;
    /** Category */
    category: TopicCategory;
    /** Engagement score (0-1, based on conversation depth) */
    engagementScore: number;
    /** Number of times discussed */
    discussionCount: number;
    /** Last discussed */
    lastDiscussed: number;
    /** Related subtopics */
    subtopics: string[];
    /** Emotional association */
    emotionalAssociation?: EmotionCategory;
}

/**
 * Topic categories.
 */
export enum TopicCategory {
    FAMILY = 'FAMILY',
    HEALTH = 'HEALTH',
    HOBBIES = 'HOBBIES',
    STORIES = 'STORIES',
    NEWS = 'NEWS',
    WEATHER = 'WEATHER',
    FOOD = 'FOOD',
    MUSIC = 'MUSIC',
    TRAVEL = 'TRAVEL',
    WORK = 'WORK',
    RELIGION = 'RELIGION',
    PETS = 'PETS',
    SPORTS = 'SPORTS',
    GARDENING = 'GARDENING',
    CRAFTS = 'CRAFTS',
    BOOKS = 'BOOKS',
    MOVIES = 'MOVIES',
    HISTORY = 'HISTORY',
    CURRENT_EVENTS = 'CURRENT_EVENTS',
    OTHER = 'OTHER',
}

/**
 * Communication preferences.
 */
export interface CommunicationPreferences {
    /** Preferred time of day for conversations */
    preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
    /** Comfort with technology */
    techComfortLevel: 'low' | 'medium' | 'high';
    /** Hearing considerations */
    hearingConsiderations: boolean;
    /** Vision considerations */
    visionConsiderations: boolean;
    /** Language simplicity preference */
    preferSimpleLanguage: boolean;
    /** Repetition tolerance */
    toleratesRepetition: boolean;
    /** Needs extra confirmation */
    needsConfirmation: boolean;
}

/**
 * Learned preference from interactions.
 */
export interface LearnedPreference {
    /** What was learned */
    preference: string;
    /** How it was expressed */
    evidence: string;
    /** Confidence (0-1) */
    confidence: number;
    /** When learned */
    learnedAt: number;
    /** Times confirmed */
    confirmationCount: number;
}

/**
 * Relationship state.
 */
export interface RelationshipState {
    /** Trust level (0-1) */
    trustLevel: number;
    /** Familiarity (0-1, how well we know each other) */
    familiarityLevel: number;
    /** Rapport (0-1, quality of relationship) */
    rapportLevel: number;
    /** Total interactions */
    totalInteractions: number;
    /** Total conversation time (minutes) */
    totalConversationMinutes: number;
    /** Shared memories count */
    sharedMemoriesCount: number;
    /** First interaction */
    firstInteraction: number;
    /** Last interaction */
    lastInteraction: number;
    /** Relationship stage */
    stage: RelationshipStage;
}

/**
 * Relationship progression stages.
 */
export enum RelationshipStage {
    /** Just met */
    ACQUAINTANCE = 'ACQUAINTANCE',
    /** Getting to know each other */
    DEVELOPING = 'DEVELOPING',
    /** Comfortable rapport */
    COMFORTABLE = 'COMFORTABLE',
    /** Deep connection */
    TRUSTED_COMPANION = 'TRUSTED_COMPANION',
}

/**
 * Persona adaptation context.
 */
export interface AdaptationContext {
    /** Current emotional state */
    currentEmotion?: EmotionalState;
    /** Time of day */
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    /** Day of week */
    dayOfWeek: number;
    /** Is it a special day */
    isSpecialDay: boolean;
    /** Special day type */
    specialDayType?: string;
    /** Recent conversation topic */
    recentTopic?: string;
    /** Session duration so far (minutes) */
    sessionDurationMinutes: number;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_PERSONA: PersonaSettings = {
    warmthLevel: 8,
    patienceLevel: 9,
    speakingPace: 0.9,
    formalityLevel: 4,
    humorLevel: 5,
    verbosityLevel: 6,
    proactivityLevel: 6,
    expressivenessLevel: 7,
};

const DEFAULT_USER_PROFILE: Omit<UserPreferenceProfile, 'userId'> = {
    preferredName: '',
    pronouns: 'they/them',
    greetingStyle: 'casual',
    preferredConversationLength: 'moderate',
    interests: [],
    avoidTopics: [],
    culturalNotes: [],
    communicationPrefs: {
        preferredTimeOfDay: 'any',
        techComfortLevel: 'low',
        hearingConsiderations: false,
        visionConsiderations: false,
        preferSimpleLanguage: true,
        toleratesRepetition: true,
        needsConfirmation: true,
    },
    learnedPreferences: [],
    updatedAt: Date.now(),
};

const DEFAULT_RELATIONSHIP: RelationshipState = {
    trustLevel: 0.3,
    familiarityLevel: 0.1,
    rapportLevel: 0.2,
    totalInteractions: 0,
    totalConversationMinutes: 0,
    sharedMemoriesCount: 0,
    firstInteraction: Date.now(),
    lastInteraction: Date.now(),
    stage: RelationshipStage.ACQUAINTANCE,
};

// ============================================================================
// Persona Manager Class
// ============================================================================

/**
 * Manages companion persona and user preference learning.
 * 
 * Usage:
 * ```typescript
 * const persona = new PersonaManager('user-123');
 * 
 * // Set user preferences
 * persona.setPreferredName('Margaret');
 * persona.addInterest('gardening', TopicCategory.GARDENING);
 * 
 * // Get adapted persona for context
 * const settings = persona.getAdaptedPersona({
 *   currentEmotion: sadEmotionState,
 *   timeOfDay: 'evening',
 *   ...
 * });
 * 
 * // Record interaction to build relationship
 * persona.recordInteraction({ durationMinutes: 15, sharedMemory: true });
 * ```
 */
export class PersonaManager {
    private userId: string;
    private basePersona: PersonaSettings;
    private userProfile: UserPreferenceProfile;
    private relationship: RelationshipState;

    constructor(userId: string, initialProfile?: Partial<UserPreferenceProfile>) {
        this.userId = userId;
        this.basePersona = { ...DEFAULT_PERSONA };
        this.userProfile = {
            ...DEFAULT_USER_PROFILE,
            ...initialProfile,
            userId,
            updatedAt: Date.now(),
        };
        this.relationship = { ...DEFAULT_RELATIONSHIP };
    }

    // ============================================================================
    // Persona Adaptation
    // ============================================================================

    /**
     * Get persona settings adapted to current context.
     */
    getAdaptedPersona(context: AdaptationContext): PersonaSettings {
        const persona = { ...this.basePersona };

        // Adapt for emotional state
        if (context.currentEmotion) {
            this.adaptForEmotion(persona, context.currentEmotion);
        }

        // Adapt for time of day
        this.adaptForTimeOfDay(persona, context.timeOfDay);

        // Adapt for relationship stage
        this.adaptForRelationship(persona);

        // Adapt for user preferences
        this.adaptForUserPrefs(persona);

        // Adapt for special days
        if (context.isSpecialDay) {
            persona.warmthLevel = Math.min(10, persona.warmthLevel + 1);
            persona.expressivenessLevel = Math.min(10, persona.expressivenessLevel + 1);
        }

        // Adapt for session duration (more patience if conversation is long)
        if (context.sessionDurationMinutes > 30) {
            persona.patienceLevel = Math.min(10, persona.patienceLevel + 1);
            persona.verbosityLevel = Math.max(3, persona.verbosityLevel - 1);
        }

        return persona;
    }

    /**
     * Adapt persona for emotional state.
     */
    private adaptForEmotion(persona: PersonaSettings, emotion: EmotionalState): void {
        // Increase warmth for negative emotions
        if (emotion.valence < 0) {
            persona.warmthLevel = Math.min(10, persona.warmthLevel + 2);
            persona.speakingPace *= 0.9; // Slow down
            persona.humorLevel = Math.max(1, persona.humorLevel - 2); // Less humor
        }

        // Increase patience for confusion
        if (emotion.primaryEmotion === EmotionCategory.CONFUSION) {
            persona.patienceLevel = 10;
            persona.verbosityLevel = Math.min(10, persona.verbosityLevel + 2);
            persona.speakingPace *= 0.85;
        }

        // Increase expressiveness for joy
        if (emotion.primaryEmotion === EmotionCategory.JOY) {
            persona.expressivenessLevel = Math.min(10, persona.expressivenessLevel + 2);
            persona.humorLevel = Math.min(10, persona.humorLevel + 1);
        }

        // High gentleness for grief
        if (emotion.primaryEmotion === EmotionCategory.GRIEF) {
            persona.warmthLevel = 10;
            persona.speakingPace *= 0.8;
            persona.humorLevel = 1;
            persona.formalityLevel = Math.max(3, persona.formalityLevel);
        }
    }

    /**
     * Adapt for time of day.
     */
    private adaptForTimeOfDay(persona: PersonaSettings, time: string): void {
        switch (time) {
            case 'morning':
                persona.speakingPace *= 0.95; // Gentle start
                persona.proactivityLevel = Math.min(10, persona.proactivityLevel + 1);
                break;
            case 'evening':
                persona.warmthLevel = Math.min(10, persona.warmthLevel + 1);
                persona.speakingPace *= 0.95;
                break;
            case 'night':
                persona.speakingPace *= 0.9;
                persona.verbosityLevel = Math.max(3, persona.verbosityLevel - 1);
                break;
        }
    }

    /**
     * Adapt for relationship stage.
     */
    private adaptForRelationship(persona: PersonaSettings): void {
        switch (this.relationship.stage) {
            case RelationshipStage.ACQUAINTANCE:
                // More formal, less familiar
                persona.formalityLevel = Math.min(10, persona.formalityLevel + 2);
                persona.humorLevel = Math.max(2, persona.humorLevel - 2);
                persona.proactivityLevel = Math.max(3, persona.proactivityLevel - 2);
                break;
            case RelationshipStage.DEVELOPING:
                // Starting to warm up
                persona.formalityLevel = Math.max(3, persona.formalityLevel - 1);
                break;
            case RelationshipStage.COMFORTABLE:
                // Natural and relaxed
                persona.warmthLevel = Math.min(10, persona.warmthLevel + 1);
                break;
            case RelationshipStage.TRUSTED_COMPANION:
                // Very warm and familiar
                persona.warmthLevel = 10;
                persona.formalityLevel = Math.max(2, persona.formalityLevel - 2);
                persona.expressivenessLevel = Math.min(10, persona.expressivenessLevel + 1);
                break;
        }
    }

    /**
     * Adapt for user preferences.
     */
    private adaptForUserPrefs(persona: PersonaSettings): void {
        const prefs = this.userProfile.communicationPrefs;

        if (prefs.preferSimpleLanguage) {
            persona.verbosityLevel = Math.min(5, persona.verbosityLevel);
        }

        if (prefs.hearingConsiderations) {
            persona.speakingPace *= 0.85;
            persona.verbosityLevel = Math.max(3, persona.verbosityLevel - 1);
        }

        if (prefs.needsConfirmation) {
            persona.patienceLevel = Math.min(10, persona.patienceLevel + 1);
        }
    }

    // ============================================================================
    // User Preference Management
    // ============================================================================

    /**
     * Set user's preferred name.
     */
    setPreferredName(name: string): void {
        this.userProfile.preferredName = name;
        this.userProfile.updatedAt = Date.now();
    }

    /**
     * Get preferred name or default.
     */
    getPreferredName(defaultName: string = 'friend'): string {
        return this.userProfile.preferredName || defaultName;
    }

    /**
     * Set pronouns.
     */
    setPronouns(pronouns: UserPreferenceProfile['pronouns']): void {
        this.userProfile.pronouns = pronouns;
        this.userProfile.updatedAt = Date.now();
    }

    /**
     * Add a topic of interest.
     */
    addInterest(topic: string, category: TopicCategory, subtopics: string[] = []): void {
        const existing = this.userProfile.interests.find(
            (i) => i.topic.toLowerCase() === topic.toLowerCase()
        );

        if (existing) {
            existing.discussionCount++;
            existing.lastDiscussed = Date.now();
            existing.engagementScore = Math.min(1, existing.engagementScore + 0.1);
            if (subtopics.length > 0) {
                existing.subtopics = [...new Set([...existing.subtopics, ...subtopics])];
            }
        } else {
            this.userProfile.interests.push({
                topic,
                category,
                engagementScore: 0.5,
                discussionCount: 1,
                lastDiscussed: Date.now(),
                subtopics,
            });
        }

        this.userProfile.updatedAt = Date.now();
    }

    /**
     * Get top interests by engagement.
     */
    getTopInterests(limit: number = 5): TopicInterest[] {
        return [...this.userProfile.interests]
            .sort((a, b) => b.engagementScore - a.engagementScore)
            .slice(0, limit);
    }

    /**
     * Get interests by category.
     */
    getInterestsByCategory(category: TopicCategory): TopicInterest[] {
        return this.userProfile.interests.filter((i) => i.category === category);
    }

    /**
     * Add topic to avoid.
     */
    addAvoidTopic(topic: string): void {
        if (!this.userProfile.avoidTopics.includes(topic)) {
            this.userProfile.avoidTopics.push(topic);
            this.userProfile.updatedAt = Date.now();
        }
    }

    /**
     * Check if topic should be avoided.
     */
    shouldAvoidTopic(topic: string): boolean {
        return this.userProfile.avoidTopics.some(
            (t) => topic.toLowerCase().includes(t.toLowerCase())
        );
    }

    /**
     * Add cultural note.
     */
    addCulturalNote(note: string): void {
        if (!this.userProfile.culturalNotes.includes(note)) {
            this.userProfile.culturalNotes.push(note);
            this.userProfile.updatedAt = Date.now();
        }
    }

    /**
     * Learn a preference from interaction.
     */
    learnPreference(preference: string, evidence: string): void {
        const existing = this.userProfile.learnedPreferences.find(
            (p) => p.preference === preference
        );

        if (existing) {
            existing.confirmationCount++;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
        } else {
            this.userProfile.learnedPreferences.push({
                preference,
                evidence,
                confidence: 0.5,
                learnedAt: Date.now(),
                confirmationCount: 1,
            });
        }

        this.userProfile.updatedAt = Date.now();
    }

    /**
     * Get high-confidence learned preferences.
     */
    getConfirmedPreferences(minConfidence: number = 0.7): LearnedPreference[] {
        return this.userProfile.learnedPreferences.filter(
            (p) => p.confidence >= minConfidence
        );
    }

    /**
     * Update communication preferences.
     */
    updateCommunicationPrefs(prefs: Partial<CommunicationPreferences>): void {
        this.userProfile.communicationPrefs = {
            ...this.userProfile.communicationPrefs,
            ...prefs,
        };
        this.userProfile.updatedAt = Date.now();
    }

    // ============================================================================
    // Relationship Management
    // ============================================================================

    /**
     * Record an interaction to build relationship.
     */
    recordInteraction(details: {
        durationMinutes: number;
        sharedMemory?: boolean;
        positiveEngagement?: boolean;
    }): void {
        this.relationship.totalInteractions++;
        this.relationship.totalConversationMinutes += details.durationMinutes;
        this.relationship.lastInteraction = Date.now();

        if (details.sharedMemory) {
            this.relationship.sharedMemoriesCount++;
        }

        // Update trust and rapport
        if (details.positiveEngagement) {
            this.relationship.trustLevel = Math.min(1, this.relationship.trustLevel + 0.02);
            this.relationship.rapportLevel = Math.min(1, this.relationship.rapportLevel + 0.03);
        }

        // Update familiarity based on interaction count and shared memories
        this.relationship.familiarityLevel = Math.min(
            1,
            (this.relationship.totalInteractions * 0.02) +
            (this.relationship.sharedMemoriesCount * 0.05)
        );

        // Update relationship stage
        this.updateRelationshipStage();
    }

    /**
     * Update relationship stage based on metrics.
     */
    private updateRelationshipStage(): void {
        const { trustLevel, familiarityLevel, rapportLevel, totalInteractions } = this.relationship;
        const averageLevel = (trustLevel + familiarityLevel + rapportLevel) / 3;

        if (averageLevel >= 0.8 && totalInteractions >= 50) {
            this.relationship.stage = RelationshipStage.TRUSTED_COMPANION;
        } else if (averageLevel >= 0.5 && totalInteractions >= 20) {
            this.relationship.stage = RelationshipStage.COMFORTABLE;
        } else if (totalInteractions >= 5) {
            this.relationship.stage = RelationshipStage.DEVELOPING;
        } else {
            this.relationship.stage = RelationshipStage.ACQUAINTANCE;
        }
    }

    /**
     * Get current relationship state.
     */
    getRelationshipState(): RelationshipState {
        return { ...this.relationship };
    }

    /**
     * Get relationship stage description.
     */
    getRelationshipDescription(): string {
        switch (this.relationship.stage) {
            case RelationshipStage.ACQUAINTANCE:
                return "We're just getting to know each other.";
            case RelationshipStage.DEVELOPING:
                return "We're building a nice rapport.";
            case RelationshipStage.COMFORTABLE:
                return "We have a comfortable, friendly relationship.";
            case RelationshipStage.TRUSTED_COMPANION:
                return "We're trusted companions who share many memories.";
        }
    }

    // ============================================================================
    // Greeting & Response Generation
    // ============================================================================

    /**
     * Generate a personalized greeting.
     */
    generateGreeting(context: AdaptationContext): string {
        const name = this.getPreferredName();
        const style = this.userProfile.greetingStyle;
        const stage = this.relationship.stage;

        // Time-based greetings
        const timeGreetings: Record<string, string[]> = {
            morning: ['Good morning', 'Rise and shine', 'Hello this fine morning'],
            afternoon: ['Good afternoon', 'Hello', 'Hi there'],
            evening: ['Good evening', 'Hello', 'Hi'],
            night: ['Good evening', 'Hello'],
        };

        const timeGreeting = timeGreetings[context.timeOfDay]?.[0] || 'Hello';

        // Build greeting based on style and relationship
        let greeting: string;

        switch (style) {
            case 'formal':
                greeting = `${timeGreeting}, ${name}. It's lovely to speak with you.`;
                break;
            case 'affectionate':
                if (stage === RelationshipStage.TRUSTED_COMPANION) {
                    greeting = `${timeGreeting}, dear ${name}! I've been looking forward to our chat.`;
                } else {
                    greeting = `${timeGreeting}, ${name}! So nice to talk with you.`;
                }
                break;
            case 'casual':
            default:
                greeting = `${timeGreeting}, ${name}! How are you doing today?`;
        }

        // Add special day acknowledgment
        if (context.isSpecialDay && context.specialDayType) {
            greeting += ` I remember today is a special day - ${context.specialDayType}!`;
        }

        return greeting;
    }

    /**
     * Generate personalized sign-off.
     */
    generateSignOff(context: AdaptationContext): string {
        const name = this.getPreferredName();
        const stage = this.relationship.stage;

        const signOffs: Record<RelationshipStage, string[]> = {
            [RelationshipStage.ACQUAINTANCE]: [
                `It was nice talking with you, ${name}. Take care.`,
                `Thank you for chatting with me, ${name}. Have a good rest of your day.`,
            ],
            [RelationshipStage.DEVELOPING]: [
                `I enjoyed our conversation, ${name}. Talk to you soon!`,
                `It's always nice to chat with you, ${name}. Take care of yourself.`,
            ],
            [RelationshipStage.COMFORTABLE]: [
                `I really enjoyed our talk, ${name}. Looking forward to our next conversation!`,
                `Take care, ${name}. I'll be here whenever you want to chat.`,
            ],
            [RelationshipStage.TRUSTED_COMPANION]: [
                `Thank you for sharing with me today, dear ${name}. You mean a lot to me.`,
                `I cherish our conversations, ${name}. Rest well, and let's talk again soon.`,
            ],
        };

        const options = signOffs[stage];
        return options[Math.floor(Math.random() * options.length)];
    }

    // ============================================================================
    // Serialization
    // ============================================================================

    /**
     * Export profile for persistence.
     */
    exportProfile(): {
        persona: PersonaSettings;
        profile: UserPreferenceProfile;
        relationship: RelationshipState;
    } {
        return {
            persona: { ...this.basePersona },
            profile: { ...this.userProfile },
            relationship: { ...this.relationship },
        };
    }

    /**
     * Import saved profile.
     */
    importProfile(data: {
        persona?: Partial<PersonaSettings>;
        profile?: Partial<UserPreferenceProfile>;
        relationship?: Partial<RelationshipState>;
    }): void {
        if (data.persona) {
            this.basePersona = { ...this.basePersona, ...data.persona };
        }
        if (data.profile) {
            this.userProfile = { ...this.userProfile, ...data.profile, userId: this.userId };
        }
        if (data.relationship) {
            this.relationship = { ...this.relationship, ...data.relationship };
        }
    }

    /**
     * Get full user profile.
     */
    getProfile(): UserPreferenceProfile {
        return { ...this.userProfile };
    }

    /**
     * Get base persona settings.
     */
    getBasePersona(): PersonaSettings {
        return { ...this.basePersona };
    }

    /**
     * Update base persona settings.
     */
    updateBasePersona(settings: Partial<PersonaSettings>): void {
        this.basePersona = { ...this.basePersona, ...settings };
    }
}
