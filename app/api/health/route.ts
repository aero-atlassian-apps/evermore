import { NextResponse } from 'next/server';
import { db } from '@/lib/infrastructure/adapters/db';
import { sql } from 'drizzle-orm';
import { storageAdapter, llmProvider } from '@/lib/infrastructure/di/container';

const startTime = Date.now();

export async function GET() {
    const checks: Record<string, 'healthy' | 'unhealthy' | 'unknown'> = {
        database: 'unknown',
        storage: 'unknown',
        vertexAI: 'unknown',
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    try {
        await db.execute(sql`SELECT 1`);
        checks.database = 'healthy';
    } catch (error) {
        checks.database = 'unhealthy';
        overallStatus = 'unhealthy';
    }

    // Storage check
    try {
        const isStorageHealthy = await storageAdapter.isAvailable();
        checks.storage = isStorageHealthy ? 'healthy' : 'unhealthy';
        if (!isStorageHealthy && overallStatus === 'healthy') overallStatus = 'degraded';
    } catch (error) {
        checks.storage = 'unhealthy';
        if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Vertex AI check (LLM connectivity)
    try {
        const testResult = await llmProvider.generateText('ok', { maxTokens: 1 });
        checks.vertexAI = testResult ? 'healthy' : 'unhealthy';
        if (!testResult && overallStatus === 'healthy') overallStatus = 'degraded';
    } catch (error) {
        checks.vertexAI = 'unhealthy';
        if (overallStatus === 'healthy') overallStatus = 'degraded';
    }


    const response = {
        status: overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        checks,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
}
