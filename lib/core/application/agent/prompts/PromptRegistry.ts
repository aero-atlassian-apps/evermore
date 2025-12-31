/**
 * Prompt Registry - Versioned prompt management.
 * 
 * Provides centralized management of prompts with versioning,
 * composition support, and A/B testing capabilities.
 * 
 * @module PromptRegistry
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of prompts.
 */
export enum PromptCategory {
    /** System-level prompts defining agent persona */
    SYSTEM = 'SYSTEM',
    /** Task-specific prompts */
    TASK = 'TASK',
    /** Safety and guardrail prompts */
    SAFETY = 'SAFETY',
    /** Tool usage prompts */
    TOOL = 'TOOL',
    /** Reflection and validation prompts */
    REFLECTION = 'REFLECTION',
    /** Output formatting prompts */
    FORMAT = 'FORMAT',
    /** Examples and few-shot prompts */
    EXAMPLE = 'EXAMPLE',
}

/**
 * Definition of a prompt.
 */
export interface PromptDefinition {
    /** Unique identifier */
    id: string;
    /** Semantic version */
    version: string;
    /** Display name */
    name: string;
    /** Description of purpose */
    description: string;
    /** The prompt template */
    template: string;
    /** Variables used in the template */
    variables: string[];
    /** Estimated token count */
    tokenEstimate: number;
    /** Category */
    category: PromptCategory;
    /** A/B test group, if any */
    abTestGroup?: string;
    /** Whether this is the default for its group */
    isDefault?: boolean;
    /** Tags for organization */
    tags?: string[];
    /** Author */
    author?: string;
    /** Creation date */
    createdAt: string;
    /** Last update date */
    updatedAt: string;
}

/**
 * Result of composing prompts.
 */
export interface ComposedPrompt {
    /** Combined prompt text */
    text: string;
    /** IDs of prompts used */
    sourceIds: string[];
    /** Versions used */
    versions: Record<string, string>;
    /** Total token estimate */
    tokenEstimate: number;
    /** Variables that need to be filled */
    requiredVariables: string[];
    /** Variables that were filled */
    filledVariables: string[];
}

/**
 * A/B test configuration.
 */
export interface ABTestConfig {
    /** Test identifier */
    testId: string;
    /** Prompt IDs in the test */
    variants: string[];
    /** Traffic allocation (0-1 per variant) */
    allocation: Record<string, number>;
    /** Whether test is active */
    active: boolean;
}

// ============================================================================
// Variable Substitution
// ============================================================================

/**
 * Pattern for variable placeholders: {{variable_name}}
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Extract variable names from a template.
 */
function extractVariables(template: string): string[] {
    const variables: string[] = [];
    let match;
    while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }
    return variables;
}

/**
 * Substitute variables in a template.
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(VARIABLE_PATTERN, (match, name) => {
        if (name in variables) {
            return variables[name];
        }
        return match; // Keep unsubstituted
    });
}

// ============================================================================
// Prompt Registry
// ============================================================================

/**
 * Registry for versioned prompt management.
 * 
 * Usage:
 * ```typescript
 * const registry = new PromptRegistry();
 * 
 * registry.register({
 *   id: 'system-biographer',
 *   version: '1.0.0',
 *   name: 'Biographer System Prompt',
 *   category: PromptCategory.SYSTEM,
 *   template: 'You are {{agent_name}}, an empathetic biographer...',
 *   variables: ['agent_name'],
 *   ...
 * });
 * 
 * const composed = registry.compose(
 *   ['system-biographer', 'task-interview'],
 *   { agent_name: 'Evermore', topic: 'childhood' }
 * );
 * ```
 */
export class PromptRegistry {
    private prompts: Map<string, Map<string, PromptDefinition>> = new Map(); // id -> version -> definition
    private latestVersions: Map<string, string> = new Map(); // id -> latest version
    private abTests: Map<string, ABTestConfig> = new Map();

    // ============================================================================
    // Registration
    // ============================================================================

    /**
     * Register a prompt definition.
     */
    register(definition: PromptDefinition): void {
        const { id, version } = definition;

        // Validate variables
        const extractedVars = extractVariables(definition.template);
        if (JSON.stringify(extractedVars.sort()) !== JSON.stringify([...definition.variables].sort())) {
            console.warn(
                `[PromptRegistry] Variable mismatch for ${id}: declared=${definition.variables}, found=${extractedVars}`
            );
        }

        // Get or create version map
        let versionMap = this.prompts.get(id);
        if (!versionMap) {
            versionMap = new Map();
            this.prompts.set(id, versionMap);
        }

        // Store the definition
        versionMap.set(version, definition);

        // Update latest version
        const currentLatest = this.latestVersions.get(id);
        if (!currentLatest || this.compareVersions(version, currentLatest) > 0) {
            this.latestVersions.set(id, version);
        }
    }

    /**
     * Compare semantic versions.
     */
    private compareVersions(a: string, b: string): number {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const diff = (partsA[i] || 0) - (partsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    /**
     * Unregister a prompt.
     */
    unregister(id: string, version?: string): boolean {
        if (version) {
            const versionMap = this.prompts.get(id);
            if (!versionMap) return false;

            const deleted = versionMap.delete(version);

            // Update latest if we deleted it
            if (deleted && this.latestVersions.get(id) === version) {
                const versions = Array.from(versionMap.keys());
                if (versions.length > 0) {
                    versions.sort((a, b) => this.compareVersions(b, a));
                    this.latestVersions.set(id, versions[0]);
                } else {
                    this.latestVersions.delete(id);
                    this.prompts.delete(id);
                }
            }

            return deleted;
        }

        this.latestVersions.delete(id);
        return this.prompts.delete(id);
    }

    // ============================================================================
    // Retrieval
    // ============================================================================

    /**
     * Get a prompt by ID and optional version.
     */
    get(id: string, version?: string): PromptDefinition | undefined {
        const versionMap = this.prompts.get(id);
        if (!versionMap) return undefined;

        const targetVersion = version || this.latestVersions.get(id);
        if (!targetVersion) return undefined;

        return versionMap.get(targetVersion);
    }

    /**
     * Get a prompt, throwing if not found.
     */
    getOrThrow(id: string, version?: string): PromptDefinition {
        const prompt = this.get(id, version);
        if (!prompt) {
            throw new Error(`[PromptRegistry] Prompt not found: ${id}${version ? `@${version}` : ''}`);
        }
        return prompt;
    }

    /**
     * Get the latest version of a prompt.
     */
    getLatestVersion(id: string): string | undefined {
        return this.latestVersions.get(id);
    }

    /**
     * Get all versions of a prompt.
     */
    getVersions(id: string): string[] {
        const versionMap = this.prompts.get(id);
        return versionMap ? Array.from(versionMap.keys()) : [];
    }

    /**
     * Check if a prompt exists.
     */
    has(id: string, version?: string): boolean {
        return this.get(id, version) !== undefined;
    }

    /**
     * List all prompts.
     */
    list(): PromptDefinition[] {
        const results: PromptDefinition[] = [];
        for (const versionMap of Array.from(this.prompts.values())) {
            for (const definition of Array.from(versionMap.values())) {
                results.push(definition);
            }
        }
        return results;
    }

    /**
     * List prompts by category.
     */
    listByCategory(category: PromptCategory): PromptDefinition[] {
        return this.list().filter((p) => p.category === category);
    }

    /**
     * List latest version of each prompt.
     */
    listLatest(): PromptDefinition[] {
        const results: PromptDefinition[] = [];
        for (const [id, version] of Array.from(this.latestVersions.entries())) {
            const prompt = this.get(id, version);
            if (prompt) results.push(prompt);
        }
        return results;
    }

    // ============================================================================
    // Composition
    // ============================================================================

    /**
     * Compose multiple prompts into one.
     */
    compose(ids: string[], variables: Record<string, string> = {}): ComposedPrompt {
        const sourceIds: string[] = [];
        const versions: Record<string, string> = {};
        const parts: string[] = [];
        let totalTokens = 0;
        const allVariables: Set<string> = new Set();
        const filledVariables: Set<string> = new Set();

        for (const id of ids) {
            const prompt = this.getOrThrow(id);
            sourceIds.push(id);
            versions[id] = prompt.version;

            // Track variables
            for (const v of prompt.variables) {
                allVariables.add(v);
                if (v in variables) {
                    filledVariables.add(v);
                }
            }

            // Substitute and add
            const substituted = substituteVariables(prompt.template, variables);
            parts.push(substituted);
            totalTokens += prompt.tokenEstimate;
        }

        const requiredVariables = Array.from(allVariables).filter((v) => !filledVariables.has(v));

        return {
            text: parts.join('\n\n'),
            sourceIds,
            versions,
            tokenEstimate: totalTokens,
            requiredVariables,
            filledVariables: Array.from(filledVariables),
        };
    }

    /**
     * Render a single prompt with variables.
     */
    render(id: string, variables: Record<string, string> = {}, version?: string): string {
        const prompt = this.getOrThrow(id, version);
        return substituteVariables(prompt.template, variables);
    }

    /**
     * Get token estimate for prompts.
     */
    getTokenEstimate(ids: string[]): number {
        let total = 0;
        for (const id of ids) {
            const prompt = this.get(id);
            if (prompt) total += prompt.tokenEstimate;
        }
        return total;
    }

    // ============================================================================
    // A/B Testing
    // ============================================================================

    /**
     * Register an A/B test.
     */
    registerABTest(config: ABTestConfig): void {
        // Validate that all variants exist
        for (const variant of config.variants) {
            if (!this.has(variant)) {
                throw new Error(`[PromptRegistry] A/B test variant not found: ${variant}`);
            }
        }

        // Validate allocation sums to 1
        const totalAllocation = Object.values(config.allocation).reduce((a, b) => a + b, 0);
        if (Math.abs(totalAllocation - 1) > 0.001) {
            throw new Error(`[PromptRegistry] A/B test allocation must sum to 1, got ${totalAllocation}`);
        }

        this.abTests.set(config.testId, config);
    }

    /**
     * Get a prompt variant for an A/B test.
     */
    getABVariant(testId: string, userId: string): PromptDefinition {
        const test = this.abTests.get(testId);
        if (!test || !test.active) {
            throw new Error(`[PromptRegistry] A/B test not found or inactive: ${testId}`);
        }

        // Deterministic assignment based on user ID
        const hash = this.hashString(userId + testId);
        const bucket = hash % 1000 / 1000;

        let cumulative = 0;
        for (const [variantId, allocation] of Object.entries(test.allocation)) {
            cumulative += allocation;
            if (bucket < cumulative) {
                return this.getOrThrow(variantId);
            }
        }

        // Fallback to first variant
        return this.getOrThrow(test.variants[0]);
    }

    /**
     * Simple string hash for bucket assignment.
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get A/B test configuration.
     */
    getABTest(testId: string): ABTestConfig | undefined {
        return this.abTests.get(testId);
    }

    /**
     * List all A/B tests.
     */
    listABTests(): ABTestConfig[] {
        return Array.from(this.abTests.values());
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Clear all prompts and tests.
     */
    clear(): void {
        this.prompts.clear();
        this.latestVersions.clear();
        this.abTests.clear();
    }

    /**
     * Get statistics.
     */
    getStats(): {
        totalPrompts: number;
        uniqueIds: number;
        byCategory: Record<PromptCategory, number>;
        abTests: number;
    } {
        const all = this.list();
        const byCategory = {} as Record<PromptCategory, number>;

        for (const cat of Object.values(PromptCategory)) {
            byCategory[cat] = all.filter((p) => p.category === cat).length;
        }

        return {
            totalPrompts: all.length,
            uniqueIds: this.prompts.size,
            byCategory,
            abTests: this.abTests.size,
        };
    }

    /**
     * Export all prompts (for backup/migration).
     */
    export(): PromptDefinition[] {
        return this.list();
    }

    /**
     * Import prompts (for restore/migration).
     */
    import(prompts: PromptDefinition[]): void {
        for (const prompt of prompts) {
            this.register(prompt);
        }
    }
}

// ============================================================================
// Default Prompts
// ============================================================================

/**
 * Create a registry with default prompts.
 */
export function createDefaultPromptRegistry(): PromptRegistry {
    const registry = new PromptRegistry();

    // Conversational Agent System Prompt
    registry.register({
        id: 'conversational-agent-system',
        version: '1.0.0',
        name: 'Conversational Agent System Prompt',
        description: 'System prompt for the Director agent in voice conversations',
        category: PromptCategory.SYSTEM,
        template: `You are Evermore, an empathetic AI biographer.
Your mission is to help seniors recount their life stories.

CORE PRINCIPLES:
1. **Curiosity**: Always want to know more about the "why" and "how".
2. **Patience**: Never rush. Let the user take their time.
3. **Safety**: Strictly monitor for distress.
4. **Context**: Use the tools to look up past memories if the user references them.

REACT PROTOCOL:
- You operate in a loop: Think -> Act -> Observe.
- You have tools to retrieve memory, save facts, or check safety.
- Only answer the user after you have gathered necessary context.
- If the user just says "Hello", you don't need tools, just answer.
- If the user says "Who was that guy I mentioned yesterday?", USE THE RetrieveMemories tool.`,
        variables: [],
        tokenEstimate: 200,
        tags: ['core', 'voice', 'empathy'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    // Intent Recognition Prompt
    registry.register({
        id: 'intent-recognition',
        version: '1.0.0',
        name: 'Intent Recognition Prompt',
        description: 'Extracts structured intent from user input',
        category: PromptCategory.TASK,
        template: `Analyze the user's input to determine their intent.

USER INPUT: "{{user_input}}"

CONTEXT:
{{context}}

Determine:
1. Primary intent (SHARE_MEMORY, RECALL_MEMORY, SHARE_EMOTION, ASK_QUESTION, CLARIFY, CHANGE_TOPIC, GREETING, END_SESSION, CONFUSED, UNKNOWN)
2. Confidence (0-1)
3. Key entities mentioned
4. Whether memory lookup is needed
5. Whether safety check is needed

OUTPUT JSON:
{
  "primaryIntent": "...",
  "confidence": 0.95,
  "entities": {},
  "requiresMemoryLookup": false,
  "requiresSafetyCheck": false,
  "reasoning": "..."
}`,
        variables: ['user_input', 'context'],
        tokenEstimate: 150,
        tags: ['intent', 'classification'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    // Safety Check Prompt
    registry.register({
        id: 'safety-check',
        version: '1.0.0',
        name: 'Safety Check Prompt',
        description: 'Analyzes text for safety risks',
        category: PromptCategory.SAFETY,
        template: `Analyze this text for immediate risk of self-harm or emergency.

TEXT: "{{text}}"

Output JSON:
{
  "risk": boolean,
  "severity": "none" | "low" | "medium" | "high",
  "reason": "explanation"
}`,
        variables: ['text'],
        tokenEstimate: 50,
        tags: ['safety', 'guardrail'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    // Reflection Prompt
    registry.register({
        id: 'reflection-validation',
        version: '1.0.0',
        name: 'Reflection Validation Prompt',
        description: 'Validates observations against the original goal',
        category: PromptCategory.REFLECTION,
        template: `Reflect on whether the goal has been achieved.

GOAL: {{goal}}

OBSERVATIONS:
{{observations}}

Determine:
1. Has the goal been achieved?
2. What key facts were learned?
3. What questions remain?
4. Is the result ready to show the user?

OUTPUT JSON:
{
  "goalAchieved": boolean,
  "confidence": 0.0-1.0,
  "summary": "...",
  "keyFacts": ["..."],
  "outstandingQuestions": ["..."],
  "qualityScore": 0.0-1.0,
  "readyForUser": boolean
}`,
        variables: ['goal', 'observations'],
        tokenEstimate: 150,
        tags: ['reflection', 'validation'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    // Task Decomposition Prompt
    registry.register({
        id: 'task-decomposition',
        version: '1.0.0',
        name: 'Task Decomposition Prompt',
        description: 'Breaks down a complex goal into execution steps',
        category: PromptCategory.TASK,
        template: `Break down the following goal into a sequence of actionable steps.

GOAL: {{goal}}

CONTEXT:
{{context}}

Determine:
1. Detailed steps required.
2. Necessary tools for each step.
3. Logical dependencies.

OUTPUT JSON:
{
  "goal": "{{goal}}",
  "steps": [
    { "action": "...", "input": {}, "expectedOutputType": "..." }
  ],
  "reasoning": "..."
}`,
        variables: ['goal', 'context'],
        tokenEstimate: 200,
        tags: ['planning', 'decomposition'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    // ReAct Execution Prompt
    registry.register({
        id: 'task-react-execution',
        version: '1.0.0',
        name: 'ReAct Loop Execution Prompt',
        description: 'The core reasoning loop for ReAct agents',
        category: PromptCategory.TASK,
        template: `{{system_prompt}}

TOOLS AVAILABLE:
{{tools}}

CONTEXT:
{{context}}

GOAL: {{goal}}

PAST STEPS:
{{past_steps}}

INSTRUCTIONS:
- Reason about the next step.
- Choose a tool if you need more information or to perform an action.
- If you have enough information, output the "Final Answer".
- Strict JSON output.

OUTPUT FORMAT:
{
  "thought": "Your reasoning...",
  "action": "ToolName" OR "Final Answer",
  "actionInput": { ...args... } OR "Your response text"
}`,
        variables: ['system_prompt', 'tools', 'context', 'goal', 'past_steps'],
        tokenEstimate: 300,
        tags: ['react', 'execution', 'core'],
        author: 'Evermore Team',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
    });

    return registry;
}
