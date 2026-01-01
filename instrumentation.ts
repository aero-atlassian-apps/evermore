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
                console.log('[Instrumentation] Starting background worker...');
                backgroundWorker.start();
                (global as unknown as { __workerStarted: boolean }).__workerStarted = true;
                console.log('[Instrumentation] Background worker started successfully');
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('[Instrumentation] CRITICAL: Failed to start background worker:', message);
            if (process.env.NODE_ENV === 'development' && e instanceof Error) {
                console.error('[Instrumentation] Error Stack:', e.stack);
            }
        }

        // Add global error handlers to catch silent crashes
        if (!(global as unknown as { __handlersInstalled: boolean }).__handlersInstalled) {
            process.on('uncaughtException', (err) => {
                console.error('[Instrumentation] 💥 UNCAUGHT EXCEPTION:', err);
                // Don't exit in dev mode if possible, or at least log it loudly
            });

            process.on('unhandledRejection', (reason, _promise) => {
                console.error('[Instrumentation] 💥 UNHANDLED REJECTION:', reason);
            });
            (global as unknown as { __handlersInstalled: boolean }).__handlersInstalled = true;
            console.log('[Instrumentation] Global error handlers installed');
        }
    }
}
