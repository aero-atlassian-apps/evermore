/**
 * Decode base64 Google Cloud credentials and return as object.
 * This enables auth in Docker/Vercel/Windows without requiring temp files.
 */
export function getGoogleCredentials() {
    const base64Creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (!base64Creds) return null;

    try {
        const credentialsJson = Buffer.from(base64Creds, 'base64').toString('utf-8');
        return JSON.parse(credentialsJson);
    } catch (e) {
        console.error('[Instrumentation] Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64:', e);
        return null;
    }
}

/**
 * Legacy support: Decode base64 Google Cloud credentials.
 * 
 * UPDATE: We now prefer in-memory credentials using `getGoogleCredentials()` in individual adapters.
 * We no longer write to a temporary file to avoid "smelly" file system side-effects and crashes.
 */
export async function setupGoogleCredentials() {
    const credentials = getGoogleCredentials();

    if (credentials) {
        console.log('[Instrumentation] Loaded Google Cloud credentials in-memory (Project:', credentials.project_id, ')');
        // We explicitly DO NOT write to a file anymore.
        // If an external library absolutely needs a file, we might need to revisit this,
        // but for now, all our internal adapters are patched.
    } else {
        console.warn('[Instrumentation] No Google Cloud credentials found in-memory.');
    }
}
