/**
 * Autonomy Control System - Bounded autonomy with human-in-the-loop.
 * 
 * Implements graduated autonomy levels:
 * - Full autonomy for safe, reversible actions
 * - Confirmation required for impactful actions
 * - Approval gates for sensitive operations
 * - Emergency halt capabilities
 * 
 * @module AutonomyControl
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Autonomy levels from most restricted to most free.
 */
export enum AutonomyLevel {
    /** Every action requires approval */
    SUPERVISED = 0,
    /** Only safe actions are autonomous */
    ASSISTED = 1,
    /** Most actions autonomous, sensitive require approval */
    COLLABORATIVE = 2,
    /** All non-critical actions autonomous */
    AUTONOMOUS = 3,
    /** Full autonomy (use with caution) */
    UNRESTRICTED = 4,
}

/**
 * Action risk levels.
 */
export enum ActionRisk {
    /** No risk, always allowed */
    SAFE = 0,
    /** Low risk, reversible */
    LOW = 1,
    /** Medium risk, may have side effects */
    MEDIUM = 2,
    /** High risk, significant impact */
    HIGH = 3,
    /** Critical, irreversible or sensitive */
    CRITICAL = 4,
}

/**
 * Decision request for autonomy system.
 */
export interface AutonomyDecisionRequest {
    /** Unique request ID */
    requestId: string;
    /** Agent requesting */
    agentId: string;
    /** Action to perform */
    action: string;
    /** Action parameters */
    parameters: Record<string, unknown>;
    /** Risk level of action */
    riskLevel: ActionRisk;
    /** Why the agent wants to take this action */
    reasoning: string;
    /** Expected outcome */
    expectedOutcome: string;
    /** Is the action reversible */
    reversible: boolean;
    /** Estimated impact */
    estimatedImpact: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Decision from autonomy system.
 */
export interface AutonomyDecision {
    /** Request ID */
    requestId: string;
    /** Whether action is allowed */
    allowed: boolean;
    /** Reason for decision */
    reason: string;
    /** Whether human confirmation was required */
    requiredConfirmation: boolean;
    /** Whether human approved (if confirmation required) */
    humanApproved?: boolean;
    /** Comments from human (if any) */
    humanComments?: string;
    /** Modified parameters (if human modified) */
    modifiedParameters?: Record<string, unknown>;
    /** Decision timestamp */
    timestamp: number;
    /** How long until decision expires */
    expiresIn?: number;
}

/**
 * Approval callback function.
 */
export type ApprovalCallback = (
    request: AutonomyDecisionRequest
) => Promise<{ approved: boolean; comments?: string; modifiedParameters?: Record<string, unknown> }>;

/**
 * Autonomy policy for an agent or action type.
 */
export interface AutonomyPolicy {
    /** Policy ID */
    id: string;
    /** Agent ID (or '*' for all) */
    agentId: string;
    /** Action pattern (regex or exact match) */
    actionPattern: string;
    /** Autonomy level for this policy */
    autonomyLevel: AutonomyLevel;
    /** Max risk level allowed without confirmation */
    maxAutoRisk: ActionRisk;
    /** Custom conditions */
    conditions?: PolicyCondition[];
    /** Whether policy is active */
    active: boolean;
    /** Priority (higher = evaluated first) */
    priority: number;
}

/**
 * Policy condition.
 */
export interface PolicyCondition {
    /** Parameter to check */
    parameter: string;
    /** Operator */
    operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt';
    /** Value to compare */
    value: unknown;
    /** Effect if condition matches */
    effect: 'allow' | 'deny' | 'confirm';
}

/**
 * Autonomy audit entry.
 */
export interface AutonomyAuditEntry {
    /** Entry ID */
    id: string;
    /** Request */
    request: AutonomyDecisionRequest;
    /** Decision */
    decision: AutonomyDecision;
    /** Policy that applied */
    policyId?: string;
    /** Execution result (if action was taken) */
    executionResult?: {
        success: boolean;
        outcome: string;
    };
}

// ============================================================================
// Autonomy Controller
// ============================================================================

/**
 * Controls agent autonomy with graduated levels and human oversight.
 * 
 * Usage:
 * ```typescript
 * const autonomy = new AutonomyController();
 * 
 * // Set approval callback
 * autonomy.setApprovalCallback(async (request) => {
 *   // Show to user, get approval
 *   return { approved: true };
 * });
 * 
 * // Set autonomy level
 * autonomy.setAutonomyLevel('react-agent', AutonomyLevel.COLLABORATIVE);
 * 
 * // Request permission for an action
 * const decision = await autonomy.requestPermission({
 *   requestId: 'req-1',
 *   agentId: 'react-agent',
 *   action: 'send_notification',
 *   riskLevel: ActionRisk.MEDIUM,
 *   ...
 * });
 * 
 * if (decision.allowed) {
 *   // Proceed with action
 * }
 * ```
 */
export class AutonomyController {
    private policies: Map<string, AutonomyPolicy> = new Map();
    private agentLevels: Map<string, AutonomyLevel> = new Map();
    private approvalCallback?: ApprovalCallback;
    private auditLog: AutonomyAuditEntry[] = [];
    private pendingRequests: Map<string, AutonomyDecisionRequest> = new Map();
    private isEmergencyHalt: boolean = false;

    /** Default autonomy level */
    private defaultLevel: AutonomyLevel = AutonomyLevel.COLLABORATIVE;

    constructor() {
        this.initializeDefaultPolicies();
    }

    /**
     * Initialize default policies.
     */
    private initializeDefaultPolicies(): void {
        // Safe actions always allowed
        this.addPolicy({
            id: 'safe-actions',
            agentId: '*',
            actionPattern: 'retrieve_*',
            autonomyLevel: AutonomyLevel.UNRESTRICTED,
            maxAutoRisk: ActionRisk.SAFE,
            active: true,
            priority: 100,
        });

        // Modification actions need collaboration
        this.addPolicy({
            id: 'modify-actions',
            agentId: '*',
            actionPattern: 'modify_*',
            autonomyLevel: AutonomyLevel.COLLABORATIVE,
            maxAutoRisk: ActionRisk.LOW,
            active: true,
            priority: 90,
        });

        // Delete actions need confirmation
        this.addPolicy({
            id: 'delete-actions',
            agentId: '*',
            actionPattern: 'delete_*',
            autonomyLevel: AutonomyLevel.ASSISTED,
            maxAutoRisk: ActionRisk.SAFE, // Never auto-delete
            active: true,
            priority: 95,
        });

        // External API calls need collaboration
        this.addPolicy({
            id: 'external-api',
            agentId: '*',
            actionPattern: 'call_external_*',
            autonomyLevel: AutonomyLevel.COLLABORATIVE,
            maxAutoRisk: ActionRisk.MEDIUM,
            active: true,
            priority: 85,
        });

        // User contact always needs approval
        this.addPolicy({
            id: 'contact-user',
            agentId: '*',
            actionPattern: 'contact_*',
            autonomyLevel: AutonomyLevel.SUPERVISED,
            maxAutoRisk: ActionRisk.SAFE, // Never auto-contact
            active: true,
            priority: 100,
        });
    }

    // ============================================================================
    // Configuration
    // ============================================================================

    /**
     * Set the approval callback.
     */
    setApprovalCallback(callback: ApprovalCallback): void {
        this.approvalCallback = callback;
    }

    /**
     * Set autonomy level for an agent.
     */
    setAutonomyLevel(agentId: string, level: AutonomyLevel): void {
        this.agentLevels.set(agentId, level);
    }

    /**
     * Get autonomy level for an agent.
     */
    getAutonomyLevel(agentId: string): AutonomyLevel {
        return this.agentLevels.get(agentId) ?? this.defaultLevel;
    }

    /**
     * Add or update a policy.
     */
    addPolicy(policy: AutonomyPolicy): void {
        this.policies.set(policy.id, policy);
    }

    /**
     * Remove a policy.
     */
    removePolicy(policyId: string): boolean {
        return this.policies.delete(policyId);
    }

    /**
     * Get all policies.
     */
    getPolicies(): AutonomyPolicy[] {
        return Array.from(this.policies.values());
    }

    // ============================================================================
    // Permission Checks
    // ============================================================================

    /**
     * Request permission for an action.
     */
    async requestPermission(request: AutonomyDecisionRequest): Promise<AutonomyDecision> {
        // Check emergency halt
        if (this.isEmergencyHalt) {
            return this.createDecision(request, false, 'Emergency halt active', false);
        }

        // Find applicable policy
        const policy = this.findApplicablePolicy(request);
        const agentLevel = this.getAutonomyLevel(request.agentId);

        // Evaluate based on policy and level
        const decision = await this.evaluateRequest(request, policy, agentLevel);

        // Audit log
        this.logAudit(request, decision, policy?.id);

        return decision;
    }

    /**
     * Find the most applicable policy.
     */
    private findApplicablePolicy(request: AutonomyDecisionRequest): AutonomyPolicy | undefined {
        const policies = Array.from(this.policies.values())
            .filter((p) => p.active)
            .filter((p) => p.agentId === '*' || p.agentId === request.agentId)
            .filter((p) => this.matchesActionPattern(request.action, p.actionPattern))
            .sort((a, b) => b.priority - a.priority);

        return policies[0];
    }

    /**
     * Check if action matches pattern.
     */
    private matchesActionPattern(action: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(action);
        }
        return action === pattern;
    }

    /**
     * Evaluate a permission request.
     */
    private async evaluateRequest(
        request: AutonomyDecisionRequest,
        policy: AutonomyPolicy | undefined,
        agentLevel: AutonomyLevel
    ): Promise<AutonomyDecision> {
        // Determine effective autonomy level
        const effectiveLevel = policy?.autonomyLevel ?? agentLevel;
        const maxAutoRisk = policy?.maxAutoRisk ?? this.getMaxAutoRiskForLevel(effectiveLevel);

        // Check custom conditions
        if (policy?.conditions) {
            for (const condition of policy.conditions) {
                const matches = this.evaluateCondition(condition, request);
                if (matches) {
                    if (condition.effect === 'deny') {
                        return this.createDecision(request, false, `Policy condition denied: ${condition.parameter}`, false);
                    }
                    if (condition.effect === 'allow') {
                        return this.createDecision(request, true, 'Policy condition allowed', false);
                    }
                    if (condition.effect === 'confirm') {
                        return await this.requestHumanApproval(request);
                    }
                }
            }
        }

        // Check risk level against autonomy
        if (request.riskLevel <= maxAutoRisk) {
            return this.createDecision(request, true, 'Within autonomous risk threshold', false);
        }

        // Need confirmation based on level
        switch (effectiveLevel) {
            case AutonomyLevel.UNRESTRICTED:
                return this.createDecision(request, true, 'Unrestricted autonomy', false);

            case AutonomyLevel.AUTONOMOUS:
                if (request.riskLevel < ActionRisk.CRITICAL) {
                    return this.createDecision(request, true, 'Autonomous level allows', false);
                }
                return await this.requestHumanApproval(request);

            case AutonomyLevel.COLLABORATIVE:
                if (request.riskLevel <= ActionRisk.LOW) {
                    return this.createDecision(request, true, 'Low risk in collaborative mode', false);
                }
                return await this.requestHumanApproval(request);

            case AutonomyLevel.ASSISTED:
                if (request.riskLevel === ActionRisk.SAFE) {
                    return this.createDecision(request, true, 'Safe action in assisted mode', false);
                }
                return await this.requestHumanApproval(request);

            case AutonomyLevel.SUPERVISED:
                return await this.requestHumanApproval(request);

            default:
                return await this.requestHumanApproval(request);
        }
    }

    /**
     * Get max auto risk for autonomy level.
     */
    private getMaxAutoRiskForLevel(level: AutonomyLevel): ActionRisk {
        switch (level) {
            case AutonomyLevel.UNRESTRICTED:
                return ActionRisk.CRITICAL;
            case AutonomyLevel.AUTONOMOUS:
                return ActionRisk.HIGH;
            case AutonomyLevel.COLLABORATIVE:
                return ActionRisk.LOW;
            case AutonomyLevel.ASSISTED:
                return ActionRisk.SAFE;
            case AutonomyLevel.SUPERVISED:
                return ActionRisk.SAFE; // None auto-allowed
            default:
                return ActionRisk.SAFE;
        }
    }

    /**
     * Evaluate a policy condition.
     */
    private evaluateCondition(condition: PolicyCondition, request: AutonomyDecisionRequest): boolean {
        const value = request.parameters[condition.parameter];

        switch (condition.operator) {
            case 'equals':
                return value === condition.value;
            case 'notEquals':
                return value !== condition.value;
            case 'contains':
                if (typeof value === 'string') {
                    return value.includes(String(condition.value));
                }
                if (Array.isArray(value)) {
                    return value.includes(condition.value);
                }
                return false;
            case 'gt':
                return typeof value === 'number' && value > (condition.value as number);
            case 'lt':
                return typeof value === 'number' && value < (condition.value as number);
            default:
                return false;
        }
    }

    /**
     * Request human approval.
     */
    private async requestHumanApproval(request: AutonomyDecisionRequest): Promise<AutonomyDecision> {
        if (!this.approvalCallback) {
            // No callback, deny by default
            return this.createDecision(request, false, 'Human approval required but no callback set', true);
        }

        this.pendingRequests.set(request.requestId, request);

        try {
            const response = await this.approvalCallback(request);
            this.pendingRequests.delete(request.requestId);

            return {
                requestId: request.requestId,
                allowed: response.approved,
                reason: response.approved ? 'Human approved' : 'Human denied',
                requiredConfirmation: true,
                humanApproved: response.approved,
                humanComments: response.comments,
                modifiedParameters: response.modifiedParameters,
                timestamp: Date.now(),
            };
        } catch (error) {
            this.pendingRequests.delete(request.requestId);
            return this.createDecision(request, false, `Approval failed: ${(error as Error).message}`, true);
        }
    }

    /**
     * Create a decision object.
     */
    private createDecision(
        request: AutonomyDecisionRequest,
        allowed: boolean,
        reason: string,
        requiredConfirmation: boolean
    ): AutonomyDecision {
        return {
            requestId: request.requestId,
            allowed,
            reason,
            requiredConfirmation,
            timestamp: Date.now(),
        };
    }

    // ============================================================================
    // Emergency Controls
    // ============================================================================

    /**
     * Activate emergency halt - stops all agent actions.
     */
    emergencyHalt(): void {
        this.isEmergencyHalt = true;
        console.warn('[AutonomyController] EMERGENCY HALT ACTIVATED');
    }

    /**
     * Resume from emergency halt.
     */
    resumeFromHalt(): void {
        this.isEmergencyHalt = false;
        console.log('[AutonomyController] Resumed from emergency halt');
    }

    /**
     * Check if in emergency halt.
     */
    isHalted(): boolean {
        return this.isEmergencyHalt;
    }

    /**
     * Get pending approval requests.
     */
    getPendingRequests(): AutonomyDecisionRequest[] {
        return Array.from(this.pendingRequests.values());
    }

    // ============================================================================
    // Audit
    // ============================================================================

    /**
     * Log an audit entry.
     */
    private logAudit(
        request: AutonomyDecisionRequest,
        decision: AutonomyDecision,
        policyId?: string
    ): void {
        const entry: AutonomyAuditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            request,
            decision,
            policyId,
        };
        this.auditLog.push(entry);

        // Keep log bounded
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-500);
        }
    }

    /**
     * Add execution result to audit entry.
     */
    recordExecutionResult(requestId: string, success: boolean, outcome: string): void {
        const entry = this.auditLog.find((e) => e.request.requestId === requestId);
        if (entry) {
            entry.executionResult = { success, outcome };
        }
    }

    /**
     * Get audit log.
     */
    getAuditLog(filter?: { agentId?: string; allowed?: boolean }): AutonomyAuditEntry[] {
        let log = this.auditLog;
        if (filter?.agentId) {
            log = log.filter((e) => e.request.agentId === filter.agentId);
        }
        if (filter?.allowed !== undefined) {
            log = log.filter((e) => e.decision.allowed === filter.allowed);
        }
        return log;
    }

    /**
     * Get autonomy statistics.
     */
    getStats(agentId?: string): AutonomyStats {
        const entries = agentId
            ? this.auditLog.filter((e) => e.request.agentId === agentId)
            : this.auditLog;

        const total = entries.length;
        const allowed = entries.filter((e) => e.decision.allowed).length;
        const denied = total - allowed;
        const humanApproved = entries.filter((e) => e.decision.humanApproved).length;
        const humanDenied = entries.filter((e) => e.decision.requiredConfirmation && !e.decision.humanApproved).length;

        return {
            totalRequests: total,
            allowed,
            denied,
            humanApproved,
            humanDenied,
            autoApprovalRate: total > 0 ? (allowed - humanApproved) / total : 0,
        };
    }
}

/**
 * Autonomy statistics.
 */
export interface AutonomyStats {
    totalRequests: number;
    allowed: number;
    denied: number;
    humanApproved: number;
    humanDenied: number;
    autoApprovalRate: number;
}
