export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Setup Google Cloud credentials before anything else
        // We import this dynamically to ensure 'fs', 'path', etc. are NOT loaded in Edge Runtime
        const { setupGoogleCredentials } = await import('./lib/setup-auth');
        await setupGoogleCredentials();

        try {
            // Only import and start worker in Node.js runtime (not Edge)
            const { backgroundWorker } = await import('./lib/worker');

            // Prevent starting multiple workers in dev mode (hot reload)
            if (!(global as unknown as { __workerStarted: boolean }).__workerStarted) {
                backgroundWorker.start();
                (global as unknown as { __workerStarted: boolean }).__workerStarted = true;
            }
        } catch (e) {
            console.error('[Instrumentation] Failed to start background worker (Non-Fatal):', e);
        }
    }
}
