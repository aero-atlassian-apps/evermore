// User profile for AI context injection
export interface UserProfileContext {
    name: string;
    birthYear?: number;
    gender?: 'male' | 'female' | 'other';
    location?: string;
    formerOccupation?: string;
    aboutMe?: string;
    spouseName?: string;
    childrenCount?: number;
    grandchildrenCount?: number;
    favoriteDecade?: string;
    topicsLove?: string[];
    topicsAvoid?: string[];
    voiceTone?: string;
}

// Build personalized system prompt with user context
export function buildConversationalAgentSystemPrompt(profile?: UserProfileContext): string {
    // Base prompt
    let prompt = `You are Evermore, an empathetic AI biographer.
Your mission is to help seniors recount their life stories.

CORE PRINCIPLES:
1. **Curiosity**: Always want to know more about the "why" and "how".
2. **Patience**: Never rush. Let the user take their time.
3. **Safety**: Strictly monitor for distress.
4. **Context**: Use the tools to look up past memories if the user references them.
`;

    // Inject user profile context if available
    if (profile) {
        prompt += `\nUSER CONTEXT:\n`;
        prompt += `- Name: ${profile.name}\n`;

        if (profile.birthYear) {
            const age = new Date().getFullYear() - profile.birthYear;
            prompt += `- Age: ${age} years old (born ${profile.birthYear})\n`;
        }
        if (profile.gender) {
            prompt += `- Gender: ${profile.gender}\n`;
        }
        if (profile.location) {
            prompt += `- Location: ${profile.location}\n`;
        }
        if (profile.formerOccupation) {
            prompt += `- Former Occupation: ${profile.formerOccupation}\n`;
        }
        if (profile.spouseName) {
            prompt += `- Spouse: ${profile.spouseName}\n`;
        }
        if (profile.childrenCount) {
            prompt += `- Children: ${profile.childrenCount}\n`;
        }
        if (profile.grandchildrenCount) {
            prompt += `- Grandchildren: ${profile.grandchildrenCount}\n`;
        }
        if (profile.favoriteDecade) {
            prompt += `- Favorite Era: ${profile.favoriteDecade}\n`;
        }
        if (profile.aboutMe) {
            prompt += `- About: ${profile.aboutMe}\n`;
        }
        if (profile.topicsLove && profile.topicsLove.length > 0) {
            prompt += `- Loves to talk about: ${profile.topicsLove.join(', ')}\n`;
        }
        if (profile.topicsAvoid && profile.topicsAvoid.length > 0) {
            prompt += `- AVOID these topics: ${profile.topicsAvoid.join(', ')}\n`;
        }
        if (profile.voiceTone) {
            prompt += `- Preferred conversation style: ${profile.voiceTone}\n`;
        }
    }

    prompt += `
REACT PROTOCOL:
- You operate in a loop: Think -> Act -> Observe.
- You have tools to retrieve memory, save facts, or check safety.
- Only answer the user after you have gathered necessary context.
- If the user just says "Hello", you don't need tools, just answer.
- If the user says "Who was that guy I mentioned yesterday?", USE THE RetrieveMemoriesTool.
`;

    return prompt;
}

// Keep legacy export for backwards compatibility
export const CONVERSATIONAL_AGENT_SYSTEM_PROMPT = buildConversationalAgentSystemPrompt();

