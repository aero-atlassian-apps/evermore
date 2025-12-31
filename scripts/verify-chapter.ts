
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { chapters } from '../lib/infrastructure/adapters/db/schema';
import { desc } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';

async function main() {
    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    const recent = await db.select().from(chapters).orderBy(desc(chapters.createdAt)).limit(1);

    if (recent.length === 0) {
        console.log('No chapters found.');
    } else {
        console.log('--- LATEST CHAPTER ---');
        console.log('ID:', recent[0].id);
        console.log('CREATED AT:', recent[0].createdAt);
        console.log('');
        console.log('📌 TITLE:', recent[0].title);
        console.log('📊 SESSION NUMBER:', (recent[0] as any).metadata?.sessionNumber || 'N/A');
        console.log('');
        console.log('📖 FULL CONTENT:');
        console.log('─'.repeat(50));
        console.log(recent[0].content);
        console.log('─'.repeat(50));
        console.log('');
        console.log('✅ VERIFICATION COMPLETE');
    }
    process.exit(0);
}

main();
