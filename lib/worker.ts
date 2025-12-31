import { jobRepository, generateChapterUseCase } from './infrastructure/di/container';
import { logger } from './core/application/Logger';

const POLLING_INTERVAL_MS = 10000; // 10 seconds

export class BackgroundWorker {
    private isRunning = false;
    private isProcessing = false;
    private intervalId: NodeJS.Timeout | null = null;

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[Worker] Background worker started');

        const interval = setInterval(() => this.processJobs(), POLLING_INTERVAL_MS);
        interval.unref(); // Allow process to exit (fixes build hang)
        this.intervalId = interval;
        // Initial run
        this.processJobs();
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('[Worker] Background worker stopped');
    }

    private async processJobs() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 1. Find pending jobs
            const jobs = await jobRepository.findPending('generate_chapter', 1); // Process 1 at a time for safety

            if (jobs.length === 0) {
                this.isProcessing = false;
                return;
            }

            for (const job of jobs) {
                logger.info(`[Worker] Processing job ${job.id} (type: ${job.type})`);

                // 2. Mark as processing
                await jobRepository.updateStatus(job.id, 'processing');

                try {
                    const payload = job.payload as any;
                    const { sessionId } = payload;
                    if (!sessionId) throw new Error('Missing sessionId in payload');

                    // 3. Execute Use Case
                    const result = await generateChapterUseCase.execute(sessionId);

                    // 4. Mark as completed
                    // @ts-ignore
                    await jobRepository.updateStatus(job.id, 'completed', undefined);
                    logger.info(`[Worker] Job ${job.id} completed successfully. Chapter: ${result}`);

                } catch (err: any) {
                    const errorMessage = err?.message || String(err);
                    const errorStack = err?.stack || '';
                    logger.error(`[Worker] Job ${job.id} failed: ${errorMessage}`);
                    console.error('[Worker] Full error:', errorMessage, errorStack);

                    // RETRY LOGIC
                    const currentRetries = (job.payload as any)?.retries || 0;
                    const maxRetries = 3;

                    if (currentRetries < maxRetries) {
                        const nextRetry = currentRetries + 1;
                        logger.warn(`[Worker] Job ${job.id} scheduled for retry ${nextRetry}/${maxRetries}`);

                        // Increment retries and set back to pending
                        const updatedPayload = { ...((job.payload as any) || {}), retries: nextRetry };
                        // Pass undefined for result/error to clear/keep them? modify updateStatus to handle optional
                        // Actually updateStatus keeps existing if undefined? No, explicit undefined might clear?
                        // Drizzle updateStatus: if (error) updates.error = error; -> so undefined error doesn't touch it.

                        await jobRepository.updateStatus(job.id, 'pending', undefined, `Retry ${nextRetry}: ${errorMessage}`, updatedPayload);
                    } else {
                        await jobRepository.updateStatus(job.id, 'failed', undefined, errorMessage);
                    }
                }
            }

        } catch (err: unknown) {
            logger.error('[Worker] Error in processing loop:', err as Record<string, unknown>);
        } finally {
            this.isProcessing = false;
        }
    }
}

// Singleton instance
export const backgroundWorker = new BackgroundWorker();
