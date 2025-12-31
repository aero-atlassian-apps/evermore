import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/infrastructure/adapters/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp',
  }
} satisfies Config;
