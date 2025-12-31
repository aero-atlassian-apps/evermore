/**
 * Hallucination Detector - Detects and flags potential hallucinations.
 * 
 * Validates generated content against ground truth sources to
 * identify potentially fabricated information.
 * 
 * @module HallucinationDetector
 */

import { LLMPort } from '../ports/LLMPort';

// ============================================================================
// Types
// ============================================================================

/**
 * Types of hallucination checks.
 */
export type HallucinationCheckType =
    | 'FACT_GROUNDING'      // Check facts against sources
    | 'ENTITY_EXISTENCE'    // Check that entities exist in sources
    | 'DATE_CONSISTENCY'    // Check date/time consistency
    | 'QUOTE_ACCURACY'      // Check quote accuracy
    | 'RELATIONSHIP'        // Check relationships between entities
    | 'TEMPORAL_ORDER'      // Check event ordering
    | 'CROSS_CHAPTER_CONSISTENCY'; // S2 hardening: Check consistency across chapters

/**
 * A ground truth source for validation.
 */
export interface GroundTruthSource {
    /** Source identifier */
    id: string;
    /** Source type */
    type: 'transcript' | 'memory' | 'document' | 'user_profile';
    /** The actual content */
    content: string;
    /** Confidence in this source */
    confidence: number;
    /** Timestamp of source */
    timestamp?: string;
}

/**
 * Request for a hallucination check.
 */
export interface HallucinationCheck {
    /** Text to check */
    text: string;
    /** Ground truth sources */
    groundTruth: GroundTruthSource[];
    /** Type of check to perform */
    checkType: HallucinationCheckType;
    /** Additional context */
    context?: string;
}

/**
 * A flagged segment of text.
 */
export interface FlaggedSegment {
    /** The flagged text */
    text: string;
    /** Start position in original */
    startIndex: number;
    /** End position in original */
    endIndex: number;
    /** Reason for flagging */
    reason: string;
    /** Confidence that this is a hallucination (0-1) */
    confidence: number;
    /** Type of issue */
    issueType: HallucinationCheckType;
    /** Evidence from ground truth */
    evidence?: string;
}

/**
 * Result of a hallucination check.
 */
export interface HallucinationResult {
    /** Whether hallucination is likely */
    isLikelyHallucination: boolean;
    /** Overall confidence in assessment */
    confidence: number;
    /** Flagged segments */
    flaggedSegments: FlaggedSegment[];
    /** Suggested corrections */
    suggestedCorrections?: string[];
    /** Summary of findings */
    summary: string;
    /** Sources that were checked */
    sourcesChecked: string[];
}

/**
 * Configuration for the detector.
 */
export interface HallucinationDetectorConfig {
    /** Confidence threshold for flagging (0-1) */
    flagThreshold: number;
    /** Maximum sources to check per request */
    maxSourcesToCheck: number;
    /** Whether to suggest corrections */
    suggestCorrections: boolean;
    /** Types of checks to perform by default */
    defaultCheckTypes: HallucinationCheckType[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: HallucinationDetectorConfig = {
    flagThreshold: 0.7,
    maxSourcesToCheck: 10,
    suggestCorrections: true,
    defaultCheckTypes: ['FACT_GROUNDING', 'ENTITY_EXISTENCE', 'DATE_CONSISTENCY'],
};

// ============================================================================
// Hallucination Detector
// ============================================================================

/**
 * Detects potential hallucinations in generated content.
 * 
 * Usage:
 * ```typescript
 * const detector = new HallucinationDetector(llm);
 * 
 * const result = await detector.check({
 *   text: 'John visited Paris in 1952 with his wife Mary.',
 *   groundTruth: [{ id: 'transcript', type: 'transcript', content: '...', confidence: 1 }],
 *   checkType: 'FACT_GROUNDING',
 * });
 * 
 * if (result.isLikelyHallucination) {
 *   console.warn('Potential hallucination:', result.flaggedSegments);
 * }
 * ```
 */
export class HallucinationDetector {
    private llm: LLMPort;
    private config: HallucinationDetectorConfig;

    constructor(llm: LLMPort, config?: Partial<HallucinationDetectorConfig>) {
        this.llm = llm;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================================================
    // Main Check Method
    // ============================================================================

    /**
     * Perform a hallucination check.
     */
    async check(input: HallucinationCheck): Promise<HallucinationResult> {
        const { text, groundTruth, checkType, context } = input;

        // Limit sources
        const sourcesToCheck = groundTruth.slice(0, this.config.maxSourcesToCheck);

        // Build prompt based on check type
        const prompt = this.buildCheckPrompt(text, sourcesToCheck, checkType, context);

        try {
            const response = await this.llm.generateJson<{
                isLikelyHallucination: boolean;
                confidence: number;
                flaggedSegments: Array<{
                    text: string;
                    startIndex: number;
                    endIndex: number;
                    reason: string;
                    confidence: number;
                    evidence?: string;
                }>;
                suggestedCorrections?: string[];
                summary: string;
            }>(prompt);

            // Add issue type to flagged segments
            const flaggedSegments: FlaggedSegment[] = response.flaggedSegments.map((seg) => ({
                ...seg,
                issueType: checkType,
            }));

            return {
                isLikelyHallucination: response.isLikelyHallucination,
                confidence: response.confidence,
                flaggedSegments,
                suggestedCorrections: response.suggestedCorrections,
                summary: response.summary,
                sourcesChecked: sourcesToCheck.map((s) => s.id),
            };
        } catch (error) {
            console.error('[HallucinationDetector] Check failed:', error);
            return {
                isLikelyHallucination: false,
                confidence: 0,
                flaggedSegments: [],
                summary: 'Hallucination check failed due to an error',
                sourcesChecked: [],
            };
        }
    }

    /**
     * Validate generated text against a transcript.
     */
    async validateAgainstTranscript(
        generated: string,
        transcript: string
    ): Promise<HallucinationResult> {
        return this.check({
            text: generated,
            groundTruth: [{
                id: 'transcript',
                type: 'transcript',
                content: transcript,
                confidence: 1,
            }],
            checkType: 'FACT_GROUNDING',
        });
    }

    /**
     * Check for entity hallucinations.
     */
    async checkEntities(
        text: string,
        knownEntities: string[],
        sources: GroundTruthSource[]
    ): Promise<HallucinationResult> {
        const prompt = `
You are checking for entity hallucinations in generated text.

GENERATED TEXT:
"${text}"

KNOWN ENTITIES (from sources):
${knownEntities.join(', ')}

SOURCE CONTENT:
${sources.map((s) => `[${s.id}]: ${s.content.substring(0, 500)}`).join('\n\n')}

TASK:
1. Identify any entities (people, places, dates, events) in the generated text
2. Check if each entity exists in the sources or known entities list
3. Flag any entities that cannot be verified

OUTPUT JSON:
{
  "isLikelyHallucination": boolean,
  "confidence": 0.0-1.0,
  "flaggedSegments": [
    {
      "text": "the entity text",
      "startIndex": 0,
      "endIndex": 10,
      "reason": "Entity not found in sources",
      "confidence": 0.0-1.0,
      "evidence": "What we found instead, if anything"
    }
  ],
  "suggestedCorrections": ["Correction 1", "..."],
  "summary": "Brief summary of findings"
}
`;

        try {
            const response = await this.llm.generateJson<{
                isLikelyHallucination: boolean;
                confidence: number;
                flaggedSegments: Array<{
                    text: string;
                    startIndex: number;
                    endIndex: number;
                    reason: string;
                    confidence: number;
                    evidence?: string;
                }>;
                suggestedCorrections?: string[];
                summary: string;
            }>(prompt);

            return {
                isLikelyHallucination: response.isLikelyHallucination,
                confidence: response.confidence,
                flaggedSegments: response.flaggedSegments.map((seg) => ({
                    ...seg,
                    issueType: 'ENTITY_EXISTENCE' as HallucinationCheckType,
                })),
                suggestedCorrections: response.suggestedCorrections,
                summary: response.summary,
                sourcesChecked: sources.map((s) => s.id),
            };
        } catch (error) {
            console.error('[HallucinationDetector] Entity check failed:', error);
            return {
                isLikelyHallucination: false,
                confidence: 0,
                flaggedSegments: [],
                summary: 'Entity check failed',
                sourcesChecked: [],
            };
        }
    }

    /**
     * Check quote accuracy.
     */
    async checkQuotes(
        text: string,
        sources: GroundTruthSource[]
    ): Promise<HallucinationResult> {
        return this.check({
            text,
            groundTruth: sources,
            checkType: 'QUOTE_ACCURACY',
        });
    }

    /**
     * Check date consistency.
     */
    async checkDates(
        text: string,
        sources: GroundTruthSource[]
    ): Promise<HallucinationResult> {
        return this.check({
            text,
            groundTruth: sources,
            checkType: 'DATE_CONSISTENCY',
        });
    }

    // ============================================================================
    // Prompt Building
    // ============================================================================

    /**
     * Build the check prompt based on type.
     */
    private buildCheckPrompt(
        text: string,
        sources: GroundTruthSource[],
        checkType: HallucinationCheckType,
        context?: string
    ): string {
        const sourceText = sources
            .map((s) => `[${s.id}] (confidence: ${s.confidence}): ${s.content.substring(0, 1000)}`)
            .join('\n\n');

        const typeInstructions = this.getTypeInstructions(checkType);

        return `
You are a hallucination detector. Your job is to verify generated content against source materials.

CHECK TYPE: ${checkType}
${typeInstructions}

GENERATED TEXT TO CHECK:
"${text}"

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

SOURCE MATERIALS (Ground Truth):
${sourceText}

TASK:
1. Carefully analyze the generated text
2. Compare claims, facts, entities, and quotes against the source materials
3. Identify any content that appears to be fabricated or unsupported
4. Provide confidence scores for each flagged segment
${this.config.suggestCorrections ? '5. Suggest corrections where possible' : ''}

OUTPUT JSON:
{
  "isLikelyHallucination": boolean,
  "confidence": 0.0-1.0,
  "flaggedSegments": [
    {
      "text": "the problematic text",
      "startIndex": 0,
      "endIndex": 10,
      "reason": "Why this is flagged",
      "confidence": 0.0-1.0,
      "evidence": "What the sources actually say"
    }
  ],
  ${this.config.suggestCorrections ? '"suggestedCorrections": ["Correction 1", "..."],' : ''}
  "summary": "Brief summary of findings"
}
`;
    }

    /**
     * Get type-specific instructions.
     */
    private getTypeInstructions(checkType: HallucinationCheckType): string {
        switch (checkType) {
            case 'FACT_GROUNDING':
                return `
INSTRUCTIONS:
- Check that all factual claims are supported by the sources
- Flag any facts that cannot be verified from the provided sources
- Pay attention to numbers, dates, names, and specific details`;

            case 'ENTITY_EXISTENCE':
                return `
INSTRUCTIONS:
- Identify all named entities (people, places, organizations, events)
- Verify each entity appears somewhere in the source materials
- Flag entities that seem to be invented`;

            case 'DATE_CONSISTENCY':
                return `
INSTRUCTIONS:
- Extract all dates and time references from the generated text
- Check for internal consistency (do events make chronological sense?)
- Verify dates match what's stated in the sources`;

            case 'QUOTE_ACCURACY':
                return `
INSTRUCTIONS:
- Identify all quoted text in the generated content
- Find the corresponding quotes in the sources
- Flag quotes that are misattributed, altered, or fabricated`;

            case 'RELATIONSHIP':
                return `
INSTRUCTIONS:
- Identify relationships between entities (family, professional, etc.)
- Verify these relationships are stated in the sources
- Flag any invented or incorrect relationships`;

            case 'TEMPORAL_ORDER':
                return `
INSTRUCTIONS:
- Extract the sequence of events described
- Verify the order matches the sources
- Flag any events that are out of order or never happened`;

            // S2 hardening: Cross-chapter consistency check
            case 'CROSS_CHAPTER_CONSISTENCY':
                return `
INSTRUCTIONS:
- This check compares facts across multiple chapters in a storybook
- Look for contradictory facts: same person with different ages, same event with different dates, etc.
- Flag any facts that conflict between the generated text and the sources
- Pay special attention to: birth dates, family relationships, place names, event sequences
- This is critical for maintaining narrative integrity over time`;

            default:
                return '';
        }
    }

    // ============================================================================
    // Batch Operations
    // ============================================================================

    /**
     * Run multiple checks on the same text.
     */
    async batchCheck(
        text: string,
        sources: GroundTruthSource[],
        checkTypes?: HallucinationCheckType[]
    ): Promise<Map<HallucinationCheckType, HallucinationResult>> {
        const types = checkTypes || this.config.defaultCheckTypes;
        const results = new Map<HallucinationCheckType, HallucinationResult>();

        for (const checkType of types) {
            const result = await this.check({
                text,
                groundTruth: sources,
                checkType,
            });
            results.set(checkType, result);
        }

        return results;
    }

    /**
     * Get combined result from batch check.
     */
    async comprehensiveCheck(
        text: string,
        sources: GroundTruthSource[],
        contentType: 'chapter' | 'storybook' | 'factual' = 'factual'
    ): Promise<{
        overallRisk: 'low' | 'medium' | 'high';
        results: Map<HallucinationCheckType, HallucinationResult>;
        allFlagged: FlaggedSegment[];
        summary: string;
    }> {
        const results = await this.batchCheck(text, sources);

        // Collect all flagged segments
        const allFlagged: FlaggedSegment[] = [];
        for (const result of Array.from(results.values())) {
            allFlagged.push(...result.flaggedSegments);
        }

        // Determine overall risk
        let overallRisk: 'low' | 'medium' | 'high' = 'low';
        const highConfidenceFlags = allFlagged.filter((f) => f.confidence >= this.config.flagThreshold);

        // Dynamic threshold based on content type
        // Storybooks are highly creative/transformative by design, so we allow more "deviations"
        // Chapters are also creative but grounded, so we allow some freedom
        // Factual content MUST be strict
        const riskThreshold = contentType === 'storybook' ? 5 :
            contentType === 'chapter' ? 3 : 1;

        if (highConfidenceFlags.length >= riskThreshold) {
            overallRisk = 'high';
        } else if (highConfidenceFlags.length >= 1) {
            overallRisk = 'medium';
        }

        // Build summary
        const summaryParts = [];
        for (const [type, result] of Array.from(results.entries())) {
            if (result.isLikelyHallucination) {
                summaryParts.push(`${type}: ${result.flaggedSegments.length} issues found`);
            }
        }

        return {
            overallRisk,
            results,
            allFlagged,
            summary: summaryParts.length > 0
                ? `Potential issues: ${summaryParts.join('; ')}`
                : 'No significant hallucinations detected',
        };
    }

    // ============================================================================
    // Configuration
    // ============================================================================

    /**
     * Get configuration.
     */
    getConfig(): HallucinationDetectorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    updateConfig(updates: Partial<HallucinationDetectorConfig>): void {
        this.config = { ...this.config, ...updates };
    }
}
