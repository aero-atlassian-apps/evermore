/**
 * Decode base64 Google Cloud credentials and write to temp file.
 * This enables Vertex AI auth in Docker/Vercel where we can't mount files.
 * 
 * NOTE: This file includes Node.js specific imports (fs, path, os) and 
 * MUST only be imported dynamically when process.env.NEXT_RUNTIME === 'nodejs'
 */
export async function setupGoogleCredentials() {
    const base64Creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;

    // Only run if we have base64 creds and no standard creds path set
    if (base64Creds && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            // Dynamically import fs/path/os to avoid Edge Runtime crashes
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');

            const credentialsJson = Buffer.from(base64Creds, 'base64').toString('utf-8');

            // Validate it's valid JSON
            const parsed = JSON.parse(credentialsJson);
            console.log('[Instrumentation] Credentials project_id:', parsed.project_id);

            // Write to temp file (cross-platform)
            // Use forward slashes for path - works on both Windows and Unix
            const tempDir = os.tmpdir().replace(/\\/g, '/');
            const tempPath = `${tempDir}/gcp-credentials.json`;

            fs.writeFileSync(tempPath, credentialsJson, { mode: 0o600 });

            // Verify file was written
            if (fs.existsSync(tempPath)) {
                // Set the standard env var that Google SDKs look for
                process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
                console.log('[Instrumentation] Google Cloud credentials loaded to:', tempPath);
            } else {
                console.error('[Instrumentation] Failed to write credentials file');
            }
        } catch (e) {
            console.error('[Instrumentation] Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64:', e);
        }
    }
}
