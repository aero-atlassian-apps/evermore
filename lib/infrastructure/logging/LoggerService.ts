
import winston from 'winston';

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export interface LoggerPort {
    debug(message: string, meta?: Record<string, any>): void;
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
}

export class LoggerService implements LoggerPort {
    private logger: winston.Logger;

    constructor() {
        const isDev = process.env.NODE_ENV === 'development';

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: isDev
                        ? winston.format.combine(
                            winston.format.colorize(),
                            winston.format.simple()
                        )
                        : winston.format.json(),
                }),
            ],
        });
    }

    debug(message: string, meta?: Record<string, any>): void {
        this.logger.debug(message, meta);
    }

    info(message: string, meta?: Record<string, any>): void {
        this.logger.info(message, meta);
    }

    warn(message: string, meta?: Record<string, any>): void {
        this.logger.warn(message, meta);
    }

    error(message: string, meta?: Record<string, any>): void {
        this.logger.error(message, meta);
    }
}

export const logger = new LoggerService();
