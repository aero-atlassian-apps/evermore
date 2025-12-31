# Database Guide

Evermore is database-agnostic but optimized for PostgreSQL.

## Drizzle ORM
We do not write raw SQL. We use [Drizzle ORM](https://orm.drizzle.team).
- **Schema**: Defined in `lib/infrastructure/adapters/db/schema.ts`.
- **Migrations**: We use `db:push` for rapid prototyping.

## Commands

| Command | Description |
|---------|-------------|
| `npm run db:push` | Pushes schema changes to the DB (Safe). |
| `npm run db:studio` | Opens a web UI to browse your data. |
| `npm run db:generate` | Generates SQL migration files (for production pipelines). |

## Production (CockroachDB)
In production, we use CockroachDB Serverless.
- It supports standard Postgres drivers.
- **Connection String**: Ensure `?sslmode=require` is appended.
- **Seeding**: We generally do *not* seed production data automatically.

## Seeding Data (Local)
To populate dummy stories:
```bash
npm run seed
```
*Note: This wipes existing data in local environment.*
