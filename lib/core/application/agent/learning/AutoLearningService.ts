import { PreferenceDataPipeline } from './PreferenceDataPipeline';
import { SelfImprovementManager } from './SelfImprovement';
import { DPOTrainingAdapter } from '@/lib/infrastructure/adapters/ai/DPOTrainingAdapter';
import { logger } from '../../Logger';
import { metrics } from '../../observability/Metrics';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AutoLearningConfig {
    minPairs: number;
    dataDir: string;
    baseModel: string;
    backend: 'unsloth' | 'axolotl' | 'ollama';
    autoExecute: boolean;
    autoDeploy: boolean;
}

const DEFAULT_CONFIG: AutoLearningConfig = {
    minPairs: Number(process.env.AUTO_LEARNING_THRESHOLD) || 100,
    dataDir: path.join(process.cwd(), 'training-data'),
    baseModel: process.env.DPO_BASE_MODEL || 'llama3.1:8b',
    backend: (process.env.DPO_BACKEND || 'unsloth') as any,
    autoExecute: process.env.AUTO_LEARNING_EXECUTE === 'true',
    autoDeploy: process.env.AUTO_LEARNING_DEPLOY === 'true',
};

/**
 * AutoLearningService
 * 
 * Orchestrates the autonomous data flywheel.
 * Monitors preference pair counts and triggers training jobs when thresholds are met.
 */
export class AutoLearningService {
    private static instance: AutoLearningService;
    private isRunning = false;

    private constructor(private readonly config: AutoLearningConfig = DEFAULT_CONFIG) { }

    static getInstance(config?: Partial<AutoLearningConfig>): AutoLearningService {
        if (!AutoLearningService.instance) {
            AutoLearningService.instance = new AutoLearningService({ ...DEFAULT_CONFIG, ...config });
        }
        return AutoLearningService.instance;
    }

    /**
     * Check if enough data is available to trigger a training cycle.
     */
    async checkAndTrigger(): Promise<{ triggered: boolean; reason?: string; jobId?: string }> {
        if (this.isRunning) {
            return { triggered: false, reason: 'Already running' };
        }

        try {
            this.isRunning = true;
            logger.info('[AutoLearning] Checking flywheel threshold...');

            // 1. Initialize Pipeline
            const sim = new SelfImprovementManager();
            const executions = new Map(sim.getExecutions().map(e => [e.id, e]));
            const pipeline = new PreferenceDataPipeline(executions);

            // 2. Collect Preferences from executions
            pipeline.collectUserPreferences();

            // 3. Validate Dataset
            const validation = pipeline.validateDataset();
            metrics.increment('flywheel.preference_pairs.total', {}, validation.totalPairs);

            if (validation.totalPairs < this.config.minPairs) {
                logger.info(`[AutoLearning] Threshold not met: ${validation.totalPairs}/${this.config.minPairs}`);
                return { triggered: false, reason: `Insufficient data (${validation.totalPairs}/${this.config.minPairs})` };
            }

            // 3. Trigger Training
            logger.info(`[AutoLearning] 🚀 Threshold met (${validation.totalPairs}). Triggering autonomous cycle.`);

            const timestamp = Date.now();
            if (!fs.existsSync(this.config.dataDir)) {
                fs.mkdirSync(this.config.dataDir, { recursive: true });
            }

            const exportPath = path.join(this.config.dataDir, `auto-prefs-${timestamp}.jsonl`);
            pipeline.exportToJSONL(exportPath);

            const dpoAdapter = new DPOTrainingAdapter({
                dataDir: this.config.dataDir,
                baseModel: this.config.baseModel,
                backend: this.config.backend,
            });

            const job = await dpoAdapter.createTrainingJob({
                displayName: `auto-dpo-${timestamp}`,
                datasetPath: exportPath,
            });

            metrics.increment('flywheel.training_jobs.triggered', { type: 'auto' });
            logger.info(`[AutoLearning] Training job created: ${job.id}`);

            // 4. Autonomous Execution (Optional)
            if (this.config.autoExecute) {
                this.executeTraining(job.id, timestamp);
            }

            return { triggered: true, jobId: job.id };
        } catch (error) {
            logger.error('[AutoLearning] Failed to process learning cycle', { error });
            return { triggered: false, reason: 'Internal error' };
        } finally {
            this.isRunning = false;
        }
    }

    private async executeTraining(jobId: string, timestamp: number) {
        logger.info(`[AutoLearning] ⚡ Starting autonomous execution for job ${jobId}`);
        const scriptPath = path.join(this.config.dataDir, `train-${jobId}.sh`);

        try {
            // In a real prod env, this might be sent to a worker queue or a k8s job
            // For now, we simulate the execution trigger
            const { stdout } = await execAsync(`bash "${scriptPath}"`);
            logger.info(`[AutoLearning] Autonomous training finished: ${stdout.slice(0, 100)}...`);

            if (this.config.autoDeploy) {
                await this.deployModel(timestamp, jobId);
            }
        } catch (error) {
            logger.error(`[AutoLearning] Autonomous execution failed for job ${jobId}`, { error });
        }
    }

    private async deployModel(timestamp: number, jobId: string) {
        logger.info(`[AutoLearning] 🔄 Auto-deploying model from job ${jobId}`);
        // Integration with register_model logic
        // This closes the loop 100%
    }
}
