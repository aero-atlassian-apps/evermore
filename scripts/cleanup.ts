/**
 * System Cleanup Script - Fresh Start Utility
 * 
 * This script wipes:
 * 1. Database (all tables)
 * 2. Pinecone (all vectors in the index)
 * 3. Upstash/Redis (flushes the database)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import Redis from 'ioredis';
import * as schema from '../lib/infrastructure/adapters/db/schema';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';
const STORIES_DIR = path.join(process.cwd(), 'seeding_stories');

async function cleanup() {
    console.log('🚮 Starting Global System Cleanup...');
    console.log('══════════════════════════════════════════════════════');

    // 1. Database Cleanup
    console.log('\n🗄️  Cleaning Database...');
    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    const tables = [
        schema.pendingAudio,
        schema.storybookImages,
        schema.storybooks,
        schema.alerts,
        schema.jobs,
        schema.chapters,
        schema.sessions,
        schema.invitations,
        schema.users,
    ];

    for (const table of tables) {
        try {
            await db.delete(table);
            console.log(`   ✅ Table cleared`);
        } catch (e: any) {
            console.log(`   ⚠️  Error clearing table: ${e.message}`);
        }
    }
    await client.end();
    console.log('   ✅ Database empty.');

    // 2. Pinecone Cleanup
    if (PINECONE_API_KEY) {
        console.log('\n🌲 Cleaning Pinecone (recall-memories)...');
        try {
            const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
            const indexName = 'recall-memories';
            const index = pc.index(indexName);

            // For Serverless, we attempt to delete by namespace if possible, 
            // but for a full wipe, we try deleteAll first.
            // If it 404s, it often means the index is already empty or 
            // the operation isn't supported on that specific endpoint.
            try {
                await index.deleteAll();
                console.log('   ✅ All vectors deleted.');
            } catch (err: any) {
                if (err.message.includes('404')) {
                    console.log('   ℹ️  Pinecone returned 404 (Index may already be empty).');
                } else {
                    console.warn(`   ⚠️  Partial Pinecone failure: ${err.message}`);
                }
            }
        } catch (e: any) {
            console.error(`   ❌ Pinecone connection failed: ${e.message}`);
        }
    } else {
        console.log('\n🌲 Skipped Pinecone (PINECONE_API_KEY not found).');
    }

    // 3. Redis/Upstash Cleanup
    const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
    if (redisUrl) {
        console.log('\n🔴 Cleaning Upstash Redis...');
        try {
            const redis = new Redis(redisUrl);
            await redis.flushdb();
            console.log('   ✅ Redis flushed.');
            await redis.quit();
        } catch (e: any) {
            console.error(`   ❌ Redis cleanup failed: ${e.message}`);
        }
    } else {
        console.log('\n🔴 Skipped Redis (URL not found).');
    }

    // 4. Seeding Stories Cleanup (Remove unwanted old files)
    console.log('\n📄 Cleaning seeding_stories directory...');
    const unwantedPrefixes = ['1-', '2-', '3-', '4-'];

    if (fs.existsSync(STORIES_DIR)) {
        const files = fs.readdirSync(STORIES_DIR);
        for (const file of files) {
            if (unwantedPrefixes.some(prefix => file.startsWith(prefix))) {
                fs.unlinkSync(path.join(STORIES_DIR, file));
                console.log(`   ✅ Deleted unwanted: ${file}`);
            }
        }
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('✨ SYSTEM CLEANED AND READY FOR FRESH START');
    console.log('══════════════════════════════════════════════════════');
    process.exit(0);
}

cleanup().catch(err => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
});
