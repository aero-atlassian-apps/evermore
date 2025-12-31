import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase uses standard PostgreSQL connection
// CockroachDB also uses standard PostgreSQL connection
// The DATABASE_URL env var determines which one is used
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';

// Create client with appropriate options
const client = postgres(connectionString, {
    // Supabase requires SSL in production
    ssl: connectionString.includes('supabase') ? 'require' : undefined,
    // Connection pool settings
    max: 10,
    idle_timeout: 20,
    // Disable prepared statements for Supabase connection pooler (pgbouncer)
    prepare: false,
});

export const db = drizzle(client, { schema });

// Export individual schema tables for convenience
export const { users, sessions, chapters, invitations, alerts, jobs, storybooks, storybookImages, pendingAudio } = schema;

// Export a function to check which DB is being used (for logging/debugging)
export function getDatabaseProvider(): 'supabase' | 'cockroachdb' | 'local' {
    if (connectionString.includes('supabase')) return 'supabase';
    if (connectionString.includes('cockroachlabs')) return 'cockroachdb';
    return 'local';
}
