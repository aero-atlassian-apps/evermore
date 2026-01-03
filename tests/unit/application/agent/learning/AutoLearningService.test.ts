import { describe, it, expect, vi, beforeEach } from 'vitest';

// Manual mock implementations that will be used
const mockSelfImprovementManager = {
    getExecutions: vi.fn(() => []),
};

const mockPreferencePipeline = {
    collectUserPreferences: vi.fn(() => []),
    validateDataset: vi.fn(() => ({ totalPairs: 0 })),
    exportToJSONL: vi.fn(),
};

const mockDPOAdapter = {
    createTrainingJob: vi.fn(() => Promise.resolve({ id: 'job-123' })),
};

// Set up all mocks before any imports
vi.mock('@/lib/core/application/agent/learning/SelfImprovement', () => ({
    SelfImprovementManager: class {
        getExecutions = mockSelfImprovementManager.getExecutions;
    },
    ExecutionOutcome: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' },
}));

vi.mock('@/lib/core/application/agent/learning/PreferenceDataPipeline', () => ({
    PreferenceDataPipeline: class {
        collectUserPreferences = mockPreferencePipeline.collectUserPreferences;
        validateDataset = mockPreferencePipeline.validateDataset;
        exportToJSONL = mockPreferencePipeline.exportToJSONL;
    },
}));

vi.mock('@/lib/infrastructure/adapters/ai/DPOTrainingAdapter', () => ({
    DPOTrainingAdapter: class {
        createTrainingJob = mockDPOAdapter.createTrainingJob;
    },
}));

vi.mock('@/lib/core/application/observability/Metrics', () => ({
    metrics: {
        increment: vi.fn(),
    },
}));

vi.mock('@/lib/core/application/Logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
}));

vi.mock('child_process', () => ({
    exec: vi.fn(),
    default: {
        exec: vi.fn(),
    },
}));

// Now import the service
import { AutoLearningService } from '@/lib/core/application/agent/learning/AutoLearningService';

describe('AutoLearningService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton
        (AutoLearningService as any).instance = undefined;
    });

    it('should not trigger training if pairs are below threshold', async () => {
        mockPreferencePipeline.validateDataset.mockReturnValueOnce({ totalPairs: 10 });

        const service = AutoLearningService.getInstance({ minPairs: 100 });
        const result = await service.checkAndTrigger();

        expect(result.triggered).toBe(false);
        expect(result.reason).toContain('Insufficient data');
    });

    it('should trigger training when threshold is met', async () => {
        mockPreferencePipeline.validateDataset.mockReturnValueOnce({ totalPairs: 200 });

        const service = AutoLearningService.getInstance({ minPairs: 10, dataDir: '/tmp/test' });
        const result = await service.checkAndTrigger();

        expect(result.triggered).toBe(true);
        expect(result.jobId).toBe('job-123');
        expect(mockDPOAdapter.createTrainingJob).toHaveBeenCalled();
    });

    it('should prevent concurrent execution', async () => {
        const service = AutoLearningService.getInstance({ minPairs: 10 });
        (service as any).isRunning = true;

        const result = await service.checkAndTrigger();
        expect(result.triggered).toBe(false);
        expect(result.reason).toBe('Already running');
    });
});
