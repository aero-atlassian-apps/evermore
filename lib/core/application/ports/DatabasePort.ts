/**
 * Database Port - Abstract interface for database operations.
 * 
 * This port allows the application to be database-agnostic.
 * 
 * **Architecture**:
 * - **Drizzle ORM**: Our query layer (SQL builder, migrations, type-safety)
 * - **DatabasePort**: Abstract connection/transaction management
 * - **Repository Pattern**: Application interacts via repositories, not raw DB
 * 
 * Implementations can be swapped via dependency injection:
 * - PostgreSQL (default)
 * - CockroachDB
 * - Supabase
 * - AWS RDS
 * - Azure SQL
 * - Neon
 * - PlanetScale (MySQL variant - requires different Drizzle driver)
 * 
 * The adapter pattern + dependency injection ensures Single Responsibility
 * and allows any database to be "plugged in or thrown to garbage".
 * 
 * @module DatabasePort
 */

/**
 * Database connection configuration.
 */
export interface DatabaseConfig {
    /** Connection URL (postgres://..., cockroachdb://..., etc.) */
    connectionUrl: string;
    /** Provider type for provider-specific optimizations */
    provider: DatabaseProvider;
    /** SSL mode */
    ssl?: 'require' | 'prefer' | 'disable' | boolean;
    /** Connection pool size */
    poolSize?: number;
    /** Connection timeout in ms */
    connectionTimeoutMs?: number;
}

/**
 * Supported database providers.
 */
export enum DatabaseProvider {
    /** Local PostgreSQL */
    POSTGRES = 'postgres',
    /** CockroachDB (Serverless or Dedicated) */
    COCKROACHDB = 'cockroachdb',
    /** Supabase Postgres */
    SUPABASE = 'supabase',
    /** AWS RDS PostgreSQL */
    AWS_RDS = 'aws_rds',
    /** Azure Database for PostgreSQL */
    AZURE_POSTGRES = 'azure_postgres',
    /** Neon Serverless Postgres */
    NEON = 'neon',
    /** PlanetScale (MySQL) */
    PLANETSCALE = 'planetscale',
}

/**
 * Transaction options.
 */
export interface TransactionOptions {
    isolationLevel?: 'read-committed' | 'repeatable-read' | 'serializable';
    readOnly?: boolean;
    timeout?: number;
}

/**
 * Health check result.
 */
export interface DatabaseHealth {
    connected: boolean;
    latencyMs: number;
    provider: DatabaseProvider;
    version?: string;
    poolStats?: {
        active: number;
        idle: number;
        waiting: number;
    };
}

/**
 * Abstract database port interface.
 * 
 * This is the contract that all database adapters must implement.
 * The application code ONLY depends on this interface, never on
 * concrete implementations.
 * 
 * @example
 * ```typescript
 * // In container.ts (Dependency Injection)
 * const databasePort: DatabasePort = 
 *   process.env.DB_PROVIDER === 'cockroachdb'
 *     ? new CockroachDBAdapter(config)
 *     : new PostgresAdapter(config);
 * ```
 */
export interface DatabasePort {
    /**
     * Initialize the database connection.
     */
    connect(): Promise<void>;

    /**
     * Close the database connection.
     */
    disconnect(): Promise<void>;

    /**
     * Check database health.
     */
    healthCheck(): Promise<DatabaseHealth>;

    /**
     * Execute a raw query (escape hatch for complex operations).
     * Use repositories for standard CRUD.
     */
    executeRaw<T>(sql: string, params?: unknown[]): Promise<T[]>;

    /**
     * Run operations in a transaction.
     */
    transaction<T>(
        fn: (tx: TransactionContext) => Promise<T>,
        options?: TransactionOptions
    ): Promise<T>;

    /**
     * Get the underlying connection for advanced use cases.
     * Use sparingly - prefer repository methods.
     */
    getConnection(): unknown;

    /**
     * Get the current provider type.
     */
    getProvider(): DatabaseProvider;
}

/**
 * Transaction context passed to transaction callbacks.
 */
export interface TransactionContext {
    /** Execute query within transaction */
    executeRaw<T>(sql: string, params?: unknown[]): Promise<T[]>;
    /** Rollback the transaction */
    rollback(): Promise<void>;
}

/**
 * Factory function type for creating database ports.
 */
export type DatabasePortFactory = (config: DatabaseConfig) => DatabasePort;
