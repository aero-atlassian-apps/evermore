/**
 * Supabase Client - Optional client for Supabase-specific features
 * 
 * This provides access to Supabase Auth and Storage APIs.
 * The Drizzle ORM repositories use the standard PostgreSQL connection (db/index.ts).
 * This client is for optional Supabase-specific features only.
 */

// Check if Supabase client package is available
let createClient: any;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    createClient = require('@supabase/supabase-js').createClient;
} catch {
    createClient = null;
    console.warn('Supabase client not installed. Some features may be disabled.');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Client-side Supabase client (uses anon key)
 * Use for: Auth, Realtime, client-facing Storage
 */
export const supabase = supabaseUrl && supabaseAnonKey && createClient
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // For server-side usage
        }
    })
    : null;

/**
 * Server-side Supabase client (uses service role key)
 * Use for: Admin operations, bypassing RLS, background jobs
 */
export const supabaseAdmin = supabaseUrl && supabaseServiceKey && createClient
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })
    : null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
    return !!(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));
}

/**
 * Get Supabase project info (for debugging)
 */
export function getSupabaseInfo() {
    return {
        configured: isSupabaseConfigured(),
        url: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').split('.')[0] : null,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceKey,
    };
}
