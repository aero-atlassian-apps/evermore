/**
 * DPO Training Adapter - Local-first implementation for model fine-tuning.
 * 
 * FREE STACK: Uses local filesystem and Unsloth/Axolotl for DPO training.
 * No cloud dependencies. $0/month recurring cost.
 * 
 * @module DPOTrainingAdapter
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * DPO Training configuration.
 */
export interface DPOTrainingConfig {
    /** Local directory for training data */
    dataDir: string;
    /** Base model to fine-tune (Ollama model name or HuggingFace ID) */
    baseModel: string;
    /** Training hyperparameters */
    hyperparameters: DPOHyperparameters;
    /** Training backend: 'unsloth' | 'axolotl' | 'ollama' */
    backend: 'unsloth' | 'axolotl' | 'ollama';
}

/**
 * DPO hyperparameters.
 */
export interface DPOHyperparameters {
    /** Learning rate */
    learningRate: number;
    /** Number of training epochs */
    epochs: number;
    /** Batch size */
    batchSize: number;
    /** Beta parameter for DPO loss */
    beta: number;
    /** Maximum sequence length */
    maxSeqLength: number;
}

/**
 * Training job configuration.
 */
export interface TrainingJobConfig {
    /** Job display name */
    displayName: string;
    /** Path to training dataset (local JSONL file) */
    datasetPath: string;
    /** Optional validation dataset path */
    validationPath?: string;
    /** Override hyperparameters */
    hyperparameters?: Partial<DPOHyperparameters>;
}

/**
 * Training job status.
 */
export interface TrainingJob {
    /** Job ID */
    id: string;
    /** Display name */
    displayName: string;
    /** Current state */
    state: TrainingState;
    /** Created timestamp */
    createTime: Date;
    /** Start timestamp */
    startTime?: Date;
    /** End timestamp */
    endTime?: Date;
    /** Error message if failed */
    error?: string;
    /** Output model path */
    outputModelPath?: string;
    /** Training metrics */
    metrics?: TrainingMetrics;
    /** Training script command */
    command?: string;
}

/**
 * Training state.
 */
export enum TrainingState {
    PENDING = 'PENDING',
    QUEUED = 'QUEUED',
    RUNNING = 'RUNNING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

/**
 * Training metrics.
 */
export interface TrainingMetrics {
    /** Training loss */
    trainingLoss: number;
    /** Validation loss (if validation set provided) */
    validationLoss?: number;
    /** DPO reward accuracy */
    rewardAccuracy: number;
    /** Wall clock time in seconds */
    wallTimeSeconds: number;
}

/**
 * Deployed model configuration.
 */
export interface DeployedModelConfig {
    /** Model name in Ollama */
    modelName: string;
    /** Model path */
    modelPath: string;
    /** Deployment timestamp */
    deployedAt: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_HYPERPARAMETERS: DPOHyperparameters = {
    learningRate: 1e-5,
    epochs: 3,
    batchSize: 4,
    beta: 0.1, // Standard DPO beta
    maxSeqLength: 2048,
};

const DEFAULT_CONFIG: DPOTrainingConfig = {
    dataDir: './training-data',
    baseModel: 'llama3.1:8b',
    hyperparameters: DEFAULT_HYPERPARAMETERS,
    backend: 'unsloth',
};

// ============================================================================
// DPO Training Adapter (FREE / LOCAL)
// ============================================================================

/**
 * Manages DPO fine-tuning workflow locally.
 * 
 * FREE STACK OPTIONS:
 * 1. Unsloth - Fast DPO training (requires local GPU)
 * 2. Axolotl - Flexible training framework (requires local GPU)
 * 3. Ollama - Create custom model from Modelfile (no GPU required for inference)
 * 
 * For GPU training without local hardware, use RunPod spot (~$0.20/hr)
 * 
 * Usage:
 * ```typescript
 * const adapter = new DPOTrainingAdapter({
 *   dataDir: './training-data',
 *   baseModel: 'llama3.1:8b',
 *   backend: 'unsloth',
 * });
 * 
 * // Save dataset locally
 * const datasetPath = await adapter.saveDataset(jsonlContent);
 * 
 * // Generate training script
 * const job = await adapter.createTrainingJob({
 *   displayName: 'dpo-v1-elder-care',
 *   datasetPath,
 * });
 * 
 * // Run training (execute generated script)
 * console.log(job.command); // Run this manually or via subprocess
 * ```
 */
export class DPOTrainingAdapter {
    private config: DPOTrainingConfig;
    private jobs: Map<string, TrainingJob> = new Map();

    constructor(config: Partial<DPOTrainingConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Ensure data directory exists
        if (!fs.existsSync(this.config.dataDir)) {
            fs.mkdirSync(this.config.dataDir, { recursive: true });
        }
    }

    // ============================================================================
    // Dataset Management (LOCAL)
    // ============================================================================

    /**
     * Save preference dataset to local filesystem.
     * Returns the path to the saved dataset.
     */
    async saveDataset(jsonlContent: string): Promise<string> {
        const timestamp = Date.now();
        const filename = `preferences-${timestamp}.jsonl`;
        const localPath = path.join(this.config.dataDir, filename);

        console.log(`[DPOTrainingAdapter] Saving dataset to ${localPath}`);

        try {
            // Validate JSONL format first
            const lines = jsonlContent.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const parsed = JSON.parse(line);
                if (!parsed.prompt || !parsed.chosen || !parsed.rejected) {
                    throw new Error('Invalid JSONL format: missing prompt, chosen, or rejected');
                }
            }
            console.log(`[DPOTrainingAdapter] Validated ${lines.length} preference pairs`);

            // Save to local filesystem (FREE!)
            fs.writeFileSync(localPath, jsonlContent, 'utf-8');
            console.log(`[DPOTrainingAdapter] Dataset saved successfully to ${localPath}`);

            return localPath;
        } catch (error) {
            console.error('[DPOTrainingAdapter] Failed to save dataset:', error);
            throw new Error(`Dataset save failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Alias for saveDataset (compatibility)
     */
    async uploadDataset(jsonlContent: string): Promise<string> {
        return this.saveDataset(jsonlContent);
    }

    // ============================================================================
    // Training Job Management (LOCAL)
    // ============================================================================

    /**
     * Create a DPO training job (generates training script).
     */
    async createTrainingJob(jobConfig: TrainingJobConfig): Promise<TrainingJob> {
        const jobId = `dpo-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const hyperparameters = {
            ...this.config.hyperparameters,
            ...jobConfig.hyperparameters
        };

        console.log(`[DPOTrainingAdapter] Creating training job: ${jobConfig.displayName}`);
        console.log(`[DPOTrainingAdapter] Base model: ${this.config.baseModel}`);
        console.log(`[DPOTrainingAdapter] Dataset: ${jobConfig.datasetPath}`);
        console.log(`[DPOTrainingAdapter] Backend: ${this.config.backend}`);

        const outputModelPath = path.join(this.config.dataDir, `${jobConfig.displayName}-model`);

        // Generate training command based on backend
        const command = this.generateTrainingCommand(jobConfig, hyperparameters, outputModelPath);

        const job: TrainingJob = {
            id: jobId,
            displayName: jobConfig.displayName,
            state: TrainingState.PENDING,
            createTime: new Date(),
            outputModelPath,
            command,
        };

        this.jobs.set(jobId, job);

        // Save training script to file
        const scriptPath = path.join(this.config.dataDir, `train-${jobId}.sh`);
        fs.writeFileSync(scriptPath, `#!/bin/bash\n\n# Training job: ${jobConfig.displayName}\n# Generated: ${new Date().toISOString()}\n\n${command}`, 'utf-8');
        console.log(`[DPOTrainingAdapter] Training script saved to: ${scriptPath}`);

        return job;
    }

    /**
     * Alias for createTrainingJob (compatibility)
     */
    async startTrainingJob(jobConfig: TrainingJobConfig): Promise<TrainingJob> {
        return this.createTrainingJob(jobConfig);
    }

    /**
     * Generate training command based on backend.
     */
    private generateTrainingCommand(
        jobConfig: TrainingJobConfig,
        hyperparameters: DPOHyperparameters,
        outputPath: string
    ): string {
        switch (this.config.backend) {
            case 'unsloth':
                return this.generateUnslothCommand(jobConfig, hyperparameters, outputPath);
            case 'axolotl':
                return this.generateAxolotlCommand(jobConfig, hyperparameters, outputPath);
            case 'ollama':
                return this.generateOllamaCommand(jobConfig, outputPath);
            default:
                return `echo "Unknown backend: ${this.config.backend}"`;
        }
    }

    /**
     * Generate Unsloth training command (FREE, requires GPU).
     */
    private generateUnslothCommand(
        jobConfig: TrainingJobConfig,
        hyperparameters: DPOHyperparameters,
        outputPath: string
    ): string {
        return `
# Unsloth DPO Training (FREE - requires local GPU)
# Install: pip install unsloth

python -c "
from unsloth import FastLanguageModel
from trl import DPOTrainer, DPOConfig
from datasets import load_dataset

# Load base model with Unsloth (4x faster training)
model, tokenizer = FastLanguageModel.from_pretrained(
    '${this.config.baseModel}',
    max_seq_length=${hyperparameters.maxSeqLength},
    load_in_4bit=True,
)

# Enable LoRA for efficient fine-tuning
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    lora_alpha=16,
    lora_dropout=0.05,
    target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj'],
)

# Load preference dataset
dataset = load_dataset('json', data_files='${jobConfig.datasetPath}')

# DPO Training
trainer = DPOTrainer(
    model=model,
    ref_model=None,  # Use implicit reference
    train_dataset=dataset['train'],
    tokenizer=tokenizer,
    args=DPOConfig(
        output_dir='${outputPath}',
        num_train_epochs=${hyperparameters.epochs},
        per_device_train_batch_size=${hyperparameters.batchSize},
        learning_rate=${hyperparameters.learningRate},
        beta=${hyperparameters.beta},
        logging_steps=10,
        save_strategy='epoch',
    ),
)

trainer.train()
model.save_pretrained('${outputPath}')
print('Training complete! Model saved to ${outputPath}')
"
`.trim();
    }

    /**
     * Generate Axolotl training command (FREE, requires GPU).
     */
    private generateAxolotlCommand(
        jobConfig: TrainingJobConfig,
        hyperparameters: DPOHyperparameters,
        outputPath: string
    ): string {
        // Generate axolotl config file
        const configPath = path.join(this.config.dataDir, `axolotl-${jobConfig.displayName}.yaml`);
        const axolotlConfig = `
base_model: ${this.config.baseModel}
dataset:
  - path: ${jobConfig.datasetPath}
    type: dpo
dpo:
  beta: ${hyperparameters.beta}
  ref_model: null
training:
  learning_rate: ${hyperparameters.learningRate}
  num_epochs: ${hyperparameters.epochs}
  batch_size: ${hyperparameters.batchSize}
  max_seq_length: ${hyperparameters.maxSeqLength}
output_dir: ${outputPath}
`.trim();
        fs.writeFileSync(configPath, axolotlConfig, 'utf-8');

        return `
# Axolotl DPO Training (FREE - requires local GPU)
# Install: pip install axolotl

accelerate launch -m axolotl.cli.train ${configPath}
echo "Training complete! Model saved to ${outputPath}"
`.trim();
    }

    /**
     * Generate Ollama Modelfile command (FREE, no GPU needed for inference).
     */
    private generateOllamaCommand(
        jobConfig: TrainingJobConfig,
        outputPath: string
    ): string {
        // For Ollama, we create a Modelfile that can customize the base model
        const modelfilePath = path.join(this.config.dataDir, `Modelfile-${jobConfig.displayName}`);
        const modelfileContent = `
# Evermore DPO-tuned model
FROM ${this.config.baseModel}

# System prompt optimized for elder care
SYSTEM """
You are Arthur, a warm and patient AI companion for seniors. 
You speak clearly, validate emotions, and prioritize safety.
You remember past conversations and build genuine connection.
"""

# Parameters tuned for elder care conversations
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
`.trim();
        fs.writeFileSync(modelfilePath, modelfileContent, 'utf-8');

        return `
# Ollama Custom Model (FREE - no GPU needed for inference)
# Note: This creates a custom model with system prompt, not true DPO fine-tuning

ollama create evermore-${jobConfig.displayName} -f ${modelfilePath}
echo "Model created! Run with: ollama run evermore-${jobConfig.displayName}"
`.trim();
    }

    /**
     * Get the status of a training job.
     */
    async getJobStatus(jobId: string): Promise<TrainingJob> {
        const job = this.jobs.get(jobId);
        if (!job) {
            throw new Error(`[DPOTrainingAdapter] Job not found: ${jobId}`);
        }
        return { ...job };
    }

    /**
     * List all training jobs.
     */
    listJobs(): TrainingJob[] {
        return Array.from(this.jobs.values()).sort((a, b) =>
            b.createTime.getTime() - a.createTime.getTime()
        );
    }

    // ============================================================================
    // Model Deployment (LOCAL / Ollama)
    // ============================================================================

    /**
     * Deploy a trained model to Ollama.
     */
    async deployModel(modelPath: string): Promise<DeployedModelConfig> {
        const modelName = `evermore-dpo-${Date.now()}`;
        console.log(`[DPOTrainingAdapter] Deploying model from ${modelPath} as ${modelName}`);

        // For models trained with Unsloth/Axolotl, convert to GGUF and load into Ollama
        console.log(`[DPOTrainingAdapter] To deploy, run:`);
        console.log(`  1. Convert to GGUF: python llama.cpp/convert.py ${modelPath} --outfile ${modelPath}.gguf`);
        console.log(`  2. Create Ollama model: ollama create ${modelName} -f Modelfile`);

        return {
            modelName,
            modelPath,
            deployedAt: new Date(),
        };
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Estimate training cost (LOCAL = FREE!).
     */
    estimateCost(datasetSize: number): {
        trainingHours: number;
        estimatedCostUsd: number;
        breakdown: Record<string, number>;
    } {
        // Local training is essentially free (just electricity)
        const tokensPerSample = 1500;
        const totalTokens = datasetSize * tokensPerSample * this.config.hyperparameters.epochs;
        const trainingHours = (totalTokens / 1_000_000) * 0.5;

        // If using RunPod spot for GPU
        const runpodCost = trainingHours * 0.2; // $0.20/hr for RTX 3090

        return {
            trainingHours: Math.round(trainingHours * 100) / 100,
            estimatedCostUsd: 0, // FREE locally!
            breakdown: {
                local: 0,
                runpod_if_needed: runpodCost,
            },
        };
    }

    /**
     * Get configuration.
     */
    getConfig(): DPOTrainingConfig {
        return { ...this.config };
    }

    /**
     * Validate configuration.
     */
    validateConfig(): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!this.config.dataDir) {
            issues.push('Missing data directory');
        }
        if (!this.config.baseModel) {
            issues.push('Missing base model');
        }
        if (this.config.hyperparameters.learningRate <= 0) {
            issues.push('Invalid learning rate');
        }
        if (this.config.hyperparameters.epochs < 1) {
            issues.push('Epochs must be at least 1');
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }
}
