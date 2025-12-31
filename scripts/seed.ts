/**
 * Database Seed Script - Arthur & Betty FOX Demo
 * 
 * Seeds two demo users for the Evermore demo:
 * - Arthur FOX (Senior, 75 years old) - alaaeddineroucadi@gmail.com
 * - Betty FOX (Family member, Arthur's daughter, 30 years old) - alaaeddine.roucadi.pro@gmail.com
 * 
 * NOTE: Login is email-based (no password required in current system)
 * 
 * Run: npm run seed
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, sessions, chapters, invitations, alerts, jobs, storybooks, storybookImages, pendingAudio } from '../lib/infrastructure/adapters/db/schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';

async function seed() {
    console.log('🌱 Starting database seed...');
    console.log('📍 Database:', DATABASE_URL.replace(/\/\/.*:.*@/, '//<hidden>@'));

    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    try {
        // ============================================================
        // STEP 1: Clear existing data (clean slate)
        // ============================================================
        console.log('🧹 Clearing existing data...');

        // Delete in correct order to respect foreign keys (children first)
        // Wrapped in try-catch for "delete only if exists" safety
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
                console.log(`   ✅ ${name} cleared`);
            } catch (e: any) {
                console.log(`   ⚠️ ${name}: ${e.message.substring(0, 50)}`);
            }
        }

        console.log('✅ All tables cleared');

        // ============================================================
        // STEP 2: Create Arthur FOX (Senior)
        // ============================================================
        const arthurId = '00000000-0000-0000-0000-000000000001';
        const bettyId = '00000000-0000-0000-0000-000000000002';

        const [arthur] = await db.insert(users).values({
            id: arthurId,
            name: 'Arthur FOX',
            email: 'alaaeddineroucadi@gmail.com',
            role: 'senior',
            phoneNumber: '+1-555-0100',
            preferences: {
                // Conversation Preferences
                voiceTone: 'Warm and Friendly',
                topicsLove: [
                    'World War II memories',
                    'Jazz music',
                    'Teaching career',
                    'Gardening',
                    'Classic cinema',
                    'Family traditions',
                    'Travel adventures'
                ],
                topicsAvoid: ['Health issues', 'Politics'],
                timezone: 'America/New_York',

                // Biographical Information
                birthYear: 1945, // Arthur born in 1945
                gender: 'male' as const,
                location: 'New York, NY',
                formerOccupation: 'High School Literature Teacher',
                aboutMe: 'A retired literature teacher who moved to New York in my early twenties. I spent my life in the classroom and meeting the most interesting people, like my dear old friend Uncle Alaa. Father of Betty, grandfather of two.',

                // Family Information
                spouseName: 'Margaret (deceased 2018)',
                childrenCount: 1,
                grandchildrenCount: 2,

                // Memory Context - Rich details for AI
                favoriteDecade: '1970s',
                significantEvents: [
                    'Moving to New York City in 1967',
                    'Meeting Uncle Alaa at the West Village cafe in 1968',
                    'First teaching job at Bronx High in 1970',
                    'Marrying Margaret in 1972',
                    'Betty\'s birth in 1994',
                    'European trip with Margaret in 2016'
                ],

                // Emergency Contact
                emergencyContact: {
                    name: 'Betty FOX',
                    phoneNumber: '+1-555-0101',
                    email: 'alaaeddine.roucadi.pro@gmail.com',
                    relationship: 'Daughter'
                }
            }
        }).returning();

        console.log('✅ Created senior user:', arthur.name, '(', arthur.email, ')');

        // ============================================================
        // STEP 3: Create Betty FOX (Family Member - Daughter)
        // ============================================================
        const [betty] = await db.insert(users).values({
            id: bettyId,
            name: 'Betty FOX',
            email: 'alaaeddine.roucadi.pro@gmail.com',
            role: 'family',
            seniorId: arthurId, // Link to Arthur
            phoneNumber: '+1-555-0101',
            preferences: {
                timezone: 'America/New_York'
            }
        }).returning();

        console.log('✅ Created family user:', betty.name, '(', betty.email, ')');

        // ============================================================
        // Summary
        // ============================================================
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('🎉 Database seeding complete!');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
        console.log('📋 Created Users:');
        console.log('');
        console.log('   👴 SENIOR: Arthur FOX');
        console.log('      Email: alaaeddineroucadi@gmail.com');
        console.log('      Age: 75 years old');
        console.log('      Role: Senior (story creator)');
        console.log('');
        console.log('   👩 FAMILY: Betty FOX');
        console.log('      Email: alaaeddine.roucadi.pro@gmail.com');
        console.log('      Age: 30 years old');
        console.log('      Role: Family (Arthur\'s daughter)');
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('📝 Login Instructions:');
        console.log('   1. Start the app: npm run dev');
        console.log('   2. Go to login page');
        console.log('   3. Enter email (no password needed currently)');
        console.log('   4. Arthur: alaaeddineroucadi@gmail.com');
        console.log('   5. Betty: alaaeddine.roucadi.pro@gmail.com');
        console.log('═══════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Seed error:', error);
        throw error;
    } finally {
        await client.end();
    }
}

seed().catch((err) => {
    console.error('Failed to seed database:', err);
    process.exit(1);
});
