import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
    chapters, sessions, jobs, users, invitations, alerts,
    storybooks, storybookImages, pendingAudio
} from '../lib/infrastructure/adapters/db/schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function clean() {
    console.log('🧹 Cleaning database (all tables)...');
    console.log('📍 Database:', DATABASE_URL.replace(/\/\/.*:.*@/, '//<hidden>@'));

    // Delete in correct order to respect foreign keys (children first)
    const tables = [
        { name: 'pendingAudio', table: pendingAudio },
        { name: 'storybookImages', table: storybookImages },
        { name: 'storybooks', table: storybooks },
        { name: 'alerts', table: alerts },
        { name: 'jobs', table: jobs },
        { name: 'chapters', table: chapters },
        { name: 'sessions', table: sessions },
        { name: 'invitations', table: invitations },
        { name: 'users', table: users },
    ];

    for (const { name, table } of tables) {
        try {
            await db.delete(table);
            console.log(`   ✅ ${name} deleted`);
        } catch (e: any) {
            console.log(`   ⚠️ ${name}: ${e.message}`);
        }
    }

    console.log('🧹 Database fully cleaned!');
    await client.end();
    process.exit(0);
}

clean();
