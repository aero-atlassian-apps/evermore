import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  userId?: string;
  [key: string]: any;
}

// Log level priority (higher = more severe)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Environment-aware logger with structured JSON output.
 * 
 * Log levels by environment:
 * - production: warn, error only (unless LOG_LEVEL override)
 * - staging: info, warn, error
 * - development/local: all levels
 */
export class Logger {
  private static instance: Logger;
  private minLevel: LogLevel;

  private constructor() {
    this.minLevel = this.determineMinLevel();
  }

  private determineMinLevel(): LogLevel {
    // Explicit override takes precedence
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
      return envLevel;
    }

    // Environment-based defaults
    const nodeEnv = process.env.NODE_ENV as string;
    switch (nodeEnv) {
      case 'production':
        return 'warn'; // Only warnings and errors in production
      case 'staging':
        return 'info';
      default:
        return 'debug'; // All logs in development
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Sanitize sensitive fields from metadata
    const sanitizedMeta = this.sanitizeMeta(meta);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitizedMeta,
    };

    // Output as JSON for log aggregators
    // In production, this goes to stdout for container log collection
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Sanitize metadata to prevent PII leakage in logs.
   */
  private sanitizeMeta(meta: Record<string, any>): Record<string, any> {
    const sanitized = { ...meta };

    // Fields that should never be logged
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'ssn',
      'creditCard',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Truncate very long strings
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[truncated]';
      }
    }

    return sanitized;
  }

  public info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  public error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  public debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  /**
   * Create a child logger with preset context.
   */
  public child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with preset context fields.
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, any>
  ) { }

  info(message: string, meta?: Record<string, any>) {
    this.parent.info(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, any>) {
    this.parent.warn(message, { ...this.context, ...meta });
  }

  error(message: string, meta?: Record<string, any>) {
    this.parent.error(message, { ...this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, any>) {
    this.parent.debug(message, { ...this.context, ...meta });
  }
}

export const logger = Logger.getInstance();
