/**
 * Agent Registry - Factory and configuration for agents.
 * 
 * Provides centralized management of agent configurations
 * and instantiation of agentic runners.
 * 
 * @module AgentRegistry
 */

import { AgenticRunnerConfig, AgenticRunner, HaltReason } from '../primitives/AgentPrimitives';
import { AgentContext, Tool } from '../types';
import { SupervisorAgent } from '../orchestration/SupervisorAgent';
import { ModelRouter, ModelProfile, ModelConfig } from '../routing/ModelRouter';
import { LLMPort } from '../../ports/LLMPort';
import { EnhancedReActAgent } from '../EnhancedReActAgent';
import { ToolRegistry as SecureToolRegistry } from '../tools/ToolContracts';

// ============================================================================
// Imports
// ============================================================================

import { EmbeddingPort } from '../../ports/EmbeddingPort';
import { VectorStorePort } from '../../ports/VectorStorePort';
import { AgentMemoryManager } from '../memory/AgentMemory';

// ============================================================================
// Agent Role Taxonomy
// ============================================================================

/**
 * Predefined roles for agents in the system.
 */
export enum AgentRole {
    /** The Director - Conversational agent for voice sessions */
    CONVERSATIONAL = 'CONVERSATIONAL',
    /** The Biographer - Writes chapters from transcripts */
    BIOGRAPHER = 'BIOGRAPHER',
    /** Creates plans from task decompositions */
    PLANNER = 'PLANNER',
    /** Executes tools and actions */
    EXECUTOR = 'EXECUTOR',
    /** Validates and critiques output */
    CRITIC = 'CRITIC',
    /** Combines results into final output */
    SYNTHESIZER = 'SYNTHESIZER',
    /** Analyzes safety and risk */
    SAFETY_GUARDIAN = 'SAFETY_GUARDIAN',
    /** Retrieves and manages context */
    CONTEXT_MANAGER = 'CONTEXT_MANAGER',
    /** Orchestrates and validates multi-agent workflows */
    SUPERVISOR = 'SUPERVISOR',
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Complete agent configuration.
 */
export interface AgentConfig {
    /** Unique identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Agent role */
    role: AgentRole;
    /** Description of what this agent does */
    description: string;
    /** Maximum steps before halting */
    maxSteps: number;
    /** Total timeout in milliseconds */
    timeoutMs: number;
    /** Token budget */
    tokenBudget: number;
    /** Cost budget in cents */
    costBudgetCents: number;
    /** Maximum replan attempts */
    maxReplanAttempts: number;
    /** Whether to validate plans */
    validatePlans: boolean;
    /** System prompt ID (from prompt registry) */
    systemPromptId: string;
    /** Available tool IDs */
    toolIds: string[];
    /** Model profile for routing */
    modelProfile: ModelProfile;
    /** Whether this agent is enabled */
    enabled: boolean;
    /** Tags for categorization */
    tags?: string[];
    /** Version of this configuration */
    version: string;
}

/**
 * Partial configuration for overriding defaults.
 */
export type AgentConfigOverride = Partial<Omit<AgentConfig, 'id' | 'role'>>;

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default configurations for each role.
 */
export const DEFAULT_CONFIGS: Record<AgentRole, Partial<AgentConfig>> = {
    [AgentRole.CONVERSATIONAL]: {
        name: 'The Director',
        description: 'Manages real-time voice conversations with empathy and context awareness',
        maxSteps: 5,
        timeoutMs: 10000,
        tokenBudget: 4000,
        costBudgetCents: 10,
        maxReplanAttempts: 2,
        validatePlans: false,
        modelProfile: ModelProfile.BALANCED,
    },
    [AgentRole.BIOGRAPHER]: {
        name: 'The Biographer',
        description: 'Converts transcripts into polished biography chapters using AoT',
        maxSteps: 10,
        timeoutMs: 60000,
        tokenBudget: 20000,
        costBudgetCents: 50,
        maxReplanAttempts: 1,
        validatePlans: true,
        modelProfile: ModelProfile.REASONING,
    },
    [AgentRole.PLANNER]: {
        name: 'The Strategist',
        description: 'Creates execution plans from task decompositions',
        maxSteps: 3,
        timeoutMs: 5000,
        tokenBudget: 2000,
        costBudgetCents: 5,
        maxReplanAttempts: 1,
        validatePlans: true,
        modelProfile: ModelProfile.FAST,
    },
    [AgentRole.EXECUTOR]: {
        name: 'The Operator',
        description: 'Executes tools and actions from plans',
        maxSteps: 10,
        timeoutMs: 30000,
        tokenBudget: 5000,
        costBudgetCents: 15,
        maxReplanAttempts: 2,
        validatePlans: false,
        modelProfile: ModelProfile.FAST,
    },
    [AgentRole.CRITIC]: {
        name: 'The Validator',
        description: 'Reviews and critiques output for quality and accuracy',
        maxSteps: 3,
        timeoutMs: 10000,
        tokenBudget: 3000,
        costBudgetCents: 10,
        maxReplanAttempts: 1,
        validatePlans: false,
        modelProfile: ModelProfile.REASONING,
    },
    [AgentRole.SYNTHESIZER]: {
        name: 'The Composer',
        description: 'Combines multiple results into coherent final output',
        maxSteps: 3,
        timeoutMs: 10000,
        tokenBudget: 4000,
        costBudgetCents: 10,
        maxReplanAttempts: 1,
        validatePlans: false,
        modelProfile: ModelProfile.BALANCED,
    },
    [AgentRole.SAFETY_GUARDIAN]: {
        name: 'The Guardian',
        description: 'Monitors content for safety risks and escalates when needed',
        maxSteps: 2,
        timeoutMs: 3000,
        tokenBudget: 1000,
        costBudgetCents: 3,
        maxReplanAttempts: 0,
        validatePlans: false,
        modelProfile: ModelProfile.SAFETY,
    },
    [AgentRole.CONTEXT_MANAGER]: {
        name: 'The Librarian',
        description: 'Retrieves and manages context from memory stores',
        maxSteps: 3,
        timeoutMs: 5000,
        tokenBudget: 2000,
        costBudgetCents: 5,
        maxReplanAttempts: 1,
        validatePlans: false,
        modelProfile: ModelProfile.FAST,
    },
    [AgentRole.SUPERVISOR]: {
        name: 'The Director',
        description: 'Orchestrates and validates multi-agent workflows for quality and safety',
        maxSteps: 5,
        timeoutMs: 15000,
        tokenBudget: 10000,
        costBudgetCents: 25,
        maxReplanAttempts: 2,
        validatePlans: true,
        modelProfile: ModelProfile.REASONING,
    },
};

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Factory function type for creating agentic runners.
 */
export type AgentFactory = (
    config: AgentConfig,
    context: AgentContext,
    llm: LLMPort,
    modelRouter: ModelRouter,
    vectorStore?: VectorStorePort,
    embeddingPort?: EmbeddingPort,
    toolRegistry?: SecureToolRegistry
) => AgenticRunner;

/**
 * Registry for agent configurations and factories.
 * 
 * Usage:
 * ```typescript
 * const registry = new AgentRegistry();
 * registry.register(myAgentConfig);
 * const runner = registry.create('my-agent', context, llm, router);
 * const result = await runner.run(goal, context);
 * ```
 */
export class AgentRegistry {
    private configs: Map<string, AgentConfig> = new Map();
    private factories: Map<AgentRole, AgentFactory> = new Map();
    private defaultFactory?: AgentFactory;

    /**
     * Register an agent configuration.
     */
    register(config: AgentConfig): void {
        if (this.configs.has(config.id)) {
            console.warn(`[AgentRegistry] Overwriting existing config: ${config.id}`);
        }
        this.configs.set(config.id, config);
    }

    /**
     * Register a factory for a specific role.
     */
    registerFactory(role: AgentRole, factory: AgentFactory): void {
        this.factories.set(role, factory);
    }

    /**
     * Set the default factory for roles without a specific factory.
     */
    setDefaultFactory(factory: AgentFactory): void {
        this.defaultFactory = factory;
    }

    /**
     * Get a configuration by ID.
     */
    get(id: string): AgentConfig | undefined {
        return this.configs.get(id);
    }

    /**
     * Get a configuration by ID, throwing if not found.
     */
    getOrThrow(id: string): AgentConfig {
        const config = this.configs.get(id);
        if (!config) {
            throw new Error(`[AgentRegistry] Agent config not found: ${id}`);
        }
        return config;
    }

    /**
     * Create an agentic runner from a registered configuration.
     */
    create(
        id: string,
        context: AgentContext,
        llm: LLMPort,
        modelRouter: ModelRouter,
        vectorStore?: VectorStorePort,
        embeddingPort?: EmbeddingPort,
        toolRegistry?: SecureToolRegistry
    ): AgenticRunner {
        const config = this.getOrThrow(id);

        if (!config.enabled) {
            throw new Error(`[AgentRegistry] Agent is disabled: ${id}`);
        }

        const factory = this.factories.get(config.role) || this.defaultFactory;

        if (!factory) {
            throw new Error(`[AgentRegistry] No factory for role: ${config.role}`);
        }

        return factory(config, context, llm, modelRouter, vectorStore, embeddingPort, toolRegistry);
    }

    /**
     * Create an agent with configuration overrides.
     */
    createWithOverrides(
        id: string,
        context: AgentContext,
        llm: LLMPort,
        modelRouter: ModelRouter,
        overrides: AgentConfigOverride,
        toolRegistry?: SecureToolRegistry
    ): AgenticRunner {
        const baseConfig = this.getOrThrow(id);
        const mergedConfig: AgentConfig = {
            ...baseConfig,
            ...overrides,
        };

        const factory = this.factories.get(mergedConfig.role) || this.defaultFactory;

        if (!factory) {
            throw new Error(`[AgentRegistry] No factory for role: ${mergedConfig.role}`);
        }

        return factory(mergedConfig, context, llm, modelRouter, undefined, undefined, toolRegistry);
    }

    /**
     * Create a quick agent from defaults for a role.
     */
    createFromRole(
        role: AgentRole,
        context: AgentContext,
        llm: LLMPort,
        modelRouter: ModelRouter,
        overrides?: AgentConfigOverride,
        toolRegistry?: SecureToolRegistry
    ): AgenticRunner {
        const defaults = DEFAULT_CONFIGS[role];
        const config: AgentConfig = {
            id: `temp-${role}-${Date.now()}`,
            role,
            enabled: true,
            version: '1.0.0',
            systemPromptId: 'default',
            toolIds: [],
            ...defaults,
            ...overrides,
        } as AgentConfig;

        const factory = this.factories.get(role) || this.defaultFactory;

        if (!factory) {
            throw new Error(`[AgentRegistry] No factory for role: ${role}`);
        }

        return factory(config, context, llm, modelRouter, undefined, undefined, toolRegistry);
    }

    /**
     * List all registered configurations.
     */
    list(): AgentConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * List enabled configurations.
     */
    listEnabled(): AgentConfig[] {
        return this.list().filter((c) => c.enabled);
    }

    /**
     * List configurations by role.
     */
    listByRole(role: AgentRole): AgentConfig[] {
        return this.list().filter((c) => c.role === role);
    }

    /**
     * Check if a configuration exists.
     */
    has(id: string): boolean {
        return this.configs.has(id);
    }

    /**
     * Remove a configuration.
     */
    unregister(id: string): boolean {
        return this.configs.delete(id);
    }

    /**
     * Clear all configurations.
     */
    clear(): void {
        this.configs.clear();
    }

    /**
     * Get statistics about registered agents.
     */
    getStats(): {
        total: number;
        enabled: number;
        byRole: Record<AgentRole, number>;
    } {
        const all = this.list();
        const byRole = {} as Record<AgentRole, number>;

        for (const role of Object.values(AgentRole)) {
            byRole[role] = all.filter((c) => c.role === role).length;
        }

        return {
            total: all.length,
            enabled: all.filter((c) => c.enabled).length,
            byRole,
        };
    }
}

// ============================================================================
// Pre-built Agent Configurations
// ============================================================================

/**
 * Create the default conversational agent configuration.
 */
export function createConversationalAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'conversational-director',
        role: AgentRole.CONVERSATIONAL,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'conversational-agent-system',
        toolIds: ['RetrieveMemories', 'CheckSafety'],
        ...DEFAULT_CONFIGS[AgentRole.CONVERSATIONAL],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create the biographer agent configuration.
 */
export function createBiographerAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'biographer-writer',
        role: AgentRole.BIOGRAPHER,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'biographer-system',
        toolIds: [],
        ...DEFAULT_CONFIGS[AgentRole.BIOGRAPHER],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create the supervisor agent configuration.
 */
export function createSupervisorAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'supervisor-director',
        role: AgentRole.SUPERVISOR,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'supervisor-system',
        toolIds: [],
        ...DEFAULT_CONFIGS[AgentRole.SUPERVISOR],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create the planner agent configuration.
 */
export function createPlannerAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'planner',
        role: AgentRole.PLANNER,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'planner-system',
        toolIds: [],
        ...DEFAULT_CONFIGS[AgentRole.PLANNER],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create the executor agent configuration.
 */
export function createExecutorAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'executor',
        role: AgentRole.EXECUTOR,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'executor-system',
        toolIds: [],
        ...DEFAULT_CONFIGS[AgentRole.EXECUTOR],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create the critic agent configuration.
 */
export function createCriticAgentConfig(
    overrides?: AgentConfigOverride
): AgentConfig {
    return {
        id: 'critic',
        role: AgentRole.CRITIC,
        enabled: true,
        version: '1.0.0',
        systemPromptId: 'critic-system',
        toolIds: [],
        ...DEFAULT_CONFIGS[AgentRole.CRITIC],
        ...overrides,
    } as AgentConfig;
}

/**
 * Create a singleton registry with default configurations.
 */
export function createDefaultRegistry(
    llm: LLMPort,
    modelRouter: ModelRouter,
    vectorStore?: VectorStorePort,
    embeddingPort?: EmbeddingPort,
    toolRegistry?: SecureToolRegistry
): AgentRegistry {
    const registry = new AgentRegistry();

    // Register default agents
    registry.register(createConversationalAgentConfig());
    registry.register(createBiographerAgentConfig());
    registry.register(createSupervisorAgentConfig());
    registry.register(createPlannerAgentConfig());
    registry.register(createExecutorAgentConfig());
    registry.register(createCriticAgentConfig());

    // Register generic factory
    registry.setDefaultFactory((config, context, l, r, v, e, tr) => {
        return new EnhancedReActAgent(l, r, [], { ...config, userId: context.userId } as any, v, e, undefined, tr || toolRegistry);
    });

    // Register supervisor factory
    registry.registerFactory(AgentRole.SUPERVISOR, (config, context, l, r, v, e, tr) => {
        return new SupervisorAgent(l, r, [], { ...config, userId: context.userId } as any, v, e, undefined, tr || toolRegistry);
    });

    return registry;
}
