/**
 * Retroactive Indexing Script
 * 
 * This script iterates through all chapters in the database and stores their 
 * narrative atoms into the Pinecone vector store if they are missing.
 * 
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/index-chapters.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { chapters } from '../lib/infrastructure/adapters/db/schema';
import { MemoryType } from '../lib/core/application/agent/memory/AgentMemory';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';

async function main() {
    console.log('🔍 Starting retroactive chapter indexing...');

    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    const { agentMemoryFactory, chapterRepository } = await import('../lib/infrastructure/di/container');
    console.log('✅ DI Container loaded.');

    const allChapters = await db.select().from(chapters);
    console.log(`Found ${allChapters.length} chapters in database.`);

    let successCount = 0;
    let failCount = 0;

    for (const chapterData of allChapters) {
        console.log(`\nProcessing: ${chapterData.title} (${chapterData.id})`);

        try {
            const memoryAgent = agentMemoryFactory(chapterData.userId);
            const atoms = (chapterData.metadata as any)?.atoms || {};

            if (!atoms.narrativeArc) {
                console.log(`   ⚠️ No narrative arc found for chapter, skipping.`);
                continue;
            }

            // 1. Store the core narrative arc as an episodic memory
            await memoryAgent.store({
                type: MemoryType.EPISODIC,
                content: `The teller shared a story about: ${atoms.narrativeArc}. ${atoms.settingDescription || ''}`,
                importance: 4, // HIGH
                tags: [...(atoms.sensoryDetails || []), 'chapter-arc', atoms.emotionalValence || 'neutral'].filter(Boolean),
                source: 'retroactive-indexer',
                relatedMemories: [],
                data: { chapterId: chapterData.id, sessionId: chapterData.sessionId }
            });

            // 2. Store key moments if available
            if (atoms.keyMoments && Array.isArray(atoms.keyMoments)) {
                for (const moment of atoms.keyMoments) {
                    await memoryAgent.store({
                        type: MemoryType.EPISODIC,
                        content: `Key Moment: ${moment.description || moment}`,
                        importance: 3, // MEDIUM
                        tags: ['key-moment', atoms.emotionalValence || 'neutral'],
                        source: 'retroactive-indexer',
                        relatedMemories: [],
                        data: { chapterId: chapterData.id }
                    });
                }
            }

            console.log(`   ✅ Indexed successfully!`);
            successCount++;
        } catch (error: any) {
            console.error(`   ❌ Failed to index "${chapterData.title}":`, error);
            failCount++;
        }
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('📊 INDEXING COMPLETE');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed:  ${failCount}`);
    console.log('══════════════════════════════════════════════════════');

    await client.end();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
