/**
 * Story Seeding Script - Simulates Conversations for Arthur FOX
 * 
 * This script:
 * 1. Reads story text files from seeding_stories/
 * 2. Creates a real session in the database
 * 3. Builds a simulated conversation transcript
 * 4. Ends the session (triggers chapter generation job)
 * 5. Processes the job immediately (runs full agentic pipeline)
 * 
 * Result: Real chapters with AI processing, memory storage, images, etc.
 * 
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-stories.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Import infrastructure
import { sessions, chapters, jobs } from '../lib/infrastructure/adapters/db/schema';

// Constants
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recall_mvp';
const ARTHUR_ID = '00000000-0000-0000-0000-000000000001';
const STORIES_DIR = path.join(__dirname, '..', 'seeding_stories');

// Generate UUID
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Build a realistic conversation transcript from story text
 * Handles both paragraph-style and short-line storytelling format
 */
function buildTranscript(storyText: string, storyTitle: string): any[] {
    const transcript: any[] = [];

    // AI opens with a warm greeting
    transcript.push({
        speaker: 'AI',
        text: `Hello Arthur! It's wonderful to chat with you again. I'd love to hear more about your memories. What story would you like to share today?`,
        timestamp: new Date().toISOString()
    });

    // Normalize line endings (Windows \r\n -> \n)
    const normalizedText = storyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split by double newlines first (paragraph breaks)
    const rawParagraphs = normalizedText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // Group short paragraphs together (for conversational short-line style)
    // Target: ~3-6 short paragraphs per speech chunk
    const speechChunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    const TARGET_CHUNK_SIZE = 200; // chars per chunk

    for (const para of rawParagraphs) {
        currentChunk.push(para);
        currentLength += para.length;

        // If we've reached target size, finalize this chunk
        if (currentLength >= TARGET_CHUNK_SIZE) {
            speechChunks.push(currentChunk.join('\n\n'));
            currentChunk = [];
            currentLength = 0;
        }
    }

    // Don't forget remaining content
    if (currentChunk.length > 0) {
        speechChunks.push(currentChunk.join('\n\n'));
    }

    console.log(`      📝 Split into ${speechChunks.length} speech chunks`);

    // Arthur shares the story in chunks, with AI responding
    for (let i = 0; i < speechChunks.length; i++) {
        const chunk = speechChunks[i];

        // User (Arthur) speaks
        transcript.push({
            speaker: 'Arthur',
            text: chunk,
            timestamp: new Date(Date.now() + (i * 30000)).toISOString() // 30 sec gaps
        });

        // AI responds with encouragement or follow-up (not on last chunk)
        if (i < speechChunks.length - 1) {
            const aiResponses = [
                "That's such a vivid memory! Please, tell me more...",
                "Hahaaa, I can really picture that! What happened next?",
                "That's beautiful, Arthur. How did that make you feel?",
                "Those details are wonderful. Please continue...",
                "I love hearing these stories. What else do you remember?",
                "Oh my, that's quite a moment! And then?",
                "You tell this so well. Go on...",
            ];
            transcript.push({
                speaker: 'AI',
                text: aiResponses[i % aiResponses.length],
                timestamp: new Date(Date.now() + (i * 30000) + 5000).toISOString()
            });
        }
    }

    // AI closes the conversation warmly
    transcript.push({
        speaker: 'AI',
        text: `Thank you so much for sharing that beautiful story about "${storyTitle}", Arthur. These memories are so precious. I'll craft this into a wonderful chapter for Betty to read. Would you like to share another story, or shall we end our session?`,
        timestamp: new Date(Date.now() + (speechChunks.length * 30000) + 10000).toISOString()
    });

    // Arthur ends
    transcript.push({
        speaker: 'Arthur',
        text: "That's all for today. Thank you for listening!",
        timestamp: new Date(Date.now() + (speechChunks.length * 30000) + 20000).toISOString()
    });

    return transcript;
}

/**
 * Extract a title from the filename  
 */
function extractTitle(filename: string): string {
    return filename
        .replace(/\.txt$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

async function seedStories() {
    console.log('📚 Story Seeding Script - Full Production Pipeline');
    console.log('══════════════════════════════════════════════════════');
    console.log('');

    // Check if stories directory exists
    if (!fs.existsSync(STORIES_DIR)) {
        console.error(`❌ Directory not found: ${STORIES_DIR}`);
        console.error('   Create seeding_stories/ folder with .txt files and run again.');
        process.exit(1);
    }

    // Read story files
    const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.txt'));

    if (storyFiles.length === 0) {
        console.log('⚠️  No .txt files found in seeding_stories/');
        console.log('   Add some story text files and run again.');
        console.log('');
        console.log('   Example: seeding_stories/my-first-memory.txt');
        process.exit(0);
    }

    console.log(`📄 Found ${storyFiles.length} story file(s):`);
    storyFiles.forEach(f => console.log(`   - ${f}`));
    console.log('');

    // Connect to database
    const client = postgres(DATABASE_URL);
    const db = drizzle(client);

    // Verify environment variables for Google Auth
    const googleProject = process.env.GOOGLE_CLOUD_PROJECT;
    let googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const googleCredsBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;

    console.log('🔑 Checking Authentication Configuration...');
    if (googleProject) {
        console.log(`   ✅ GOOGLE_CLOUD_PROJECT found: ${googleProject}`);
    } else {
        console.error(`   ❌ GOOGLE_CLOUD_PROJECT is missing!`);
    }

    // Handle Base64 credentials (decode to temp file if needed)
    if (!googleCreds && googleCredsBase64) {
        console.log(`   📦 GOOGLE_APPLICATION_CREDENTIALS_BASE64 found, decoding...`);
        try {
            const credsJson = Buffer.from(googleCredsBase64, 'base64').toString('utf-8');
            const tempCredsPath = path.join(process.cwd(), '.google-credentials-temp.json');
            fs.writeFileSync(tempCredsPath, credsJson, 'utf-8');
            process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredsPath;
            googleCreds = tempCredsPath;
            console.log(`   ✅ Decoded credentials to: ${tempCredsPath}`);

            // Extract project_id and set GOOGLE_CLOUD_PROJECT if missing
            if (!googleProject) {
                try {
                    const parsed = JSON.parse(credsJson);
                    if (parsed.project_id) {
                        process.env.GOOGLE_CLOUD_PROJECT = parsed.project_id;
                        console.log(`   ✅ Auto-detected GOOGLE_CLOUD_PROJECT from credentials: ${parsed.project_id}`);
                    }
                } catch (e) {
                    console.warn('   ⚠️ Could not parse project_id from credentials');
                }
            }
        } catch (e: any) {
            console.error(`   ❌ Failed to decode Base64 credentials:`, e.message);
        }
    }

    if (googleCreds) {
        if (fs.existsSync(googleCreds)) {
            console.log(`   ✅ GOOGLE_APPLICATION_CREDENTIALS file exists`);
        } else {
            console.error(`   ❌ GOOGLE_APPLICATION_CREDENTIALS file NOT FOUND at: ${googleCreds}`);
        }
    } else {
        console.log(`   ⚠️  No Google credentials found. Image generation may fail.`);
    }
    console.log('');

    // Import the real use cases dynamically (so env is loaded)
    console.log('🔌 Loading production dependencies...');
    let generateChapterUseCase: any, jobRepository: any, sessionRepository: any, chapterRepository: any;
    try {
        const di = await import('../lib/infrastructure/di/container');
        generateChapterUseCase = di.generateChapterUseCase;
        jobRepository = di.jobRepository;
        sessionRepository = di.sessionRepository;
        chapterRepository = di.chapterRepository;
        console.log('✅ Dependencies loaded successfully');
    } catch (e: any) {
        console.error('❌ Failed to load production dependencies:', e);
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    for (const filename of storyFiles) {
        const storyTitle = extractTitle(filename);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📖 Processing: ${storyTitle}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        try {
            // 1. Read story content
            const storyPath = path.join(STORIES_DIR, filename);
            const storyText = fs.readFileSync(storyPath, 'utf-8').trim();
            console.log(`   📝 Story length: ${storyText.length} characters`);

            // 2. Build transcript
            const transcript = buildTranscript(storyText, storyTitle);
            console.log(`   💬 Transcript: ${transcript.length} messages`);

            // 3. Create session directly in DB
            const sessionId = generateUUID();
            const now = new Date();
            const duration = transcript.length * 30; // ~30 sec per message

            await db.insert(sessions).values({
                id: sessionId,
                userId: ARTHUR_ID,
                transcriptRaw: transcript,
                status: 'completed',
                duration: duration,
                startedAt: new Date(now.getTime() - duration * 1000),
                endedAt: now
            } as any); // Cast to any for flexibility with schema strict types
            console.log(`   ✅ Session created: ${sessionId}`);

            // 4. Create job for chapter generation
            const jobId = generateUUID();
            await db.insert(jobs).values({
                id: jobId,
                type: 'generate_chapter',
                status: 'pending',
                payload: { sessionId },
                createdAt: now
            });
            console.log(`   📋 Job queued: ${jobId}`);

            // 5. Process the job immediately (full agentic pipeline!)
            console.log(`   🚀 Running chapter generation pipeline...`);
            console.log(`      ├─ LLM processing...`);
            console.log(`      ├─ Memory storage...`);
            console.log(`      ├─ Image generation...`);

            const chapterId = await generateChapterUseCase.execute(sessionId);
            console.log(`Successfully generated chapter: ${chapterId}`);

            // VERIFICATION: Retrieve and log a preview of the chapter content to confirm "Invisible AI" voice
            const chapter = await chapterRepository.findById(chapterId);
            if (chapter) {
                console.error('\n--- CHAPTER PREVIEW (First 300 chars) ---');
                console.error(chapter.content.substring(0, 300));
                console.error('--- END PREVIEW ---\n');
            }
            await jobRepository.updateStatus(jobId, 'completed', { chapterId });

            console.log(`      └─ ✅ Chapter created: ${chapterId}`);
            console.log(`   🎉 Story "${storyTitle}" seeded successfully!`);
            successCount++;

        } catch (error: any) {
            console.error(`   ❌ Failed to seed "${storyTitle}":`, error.message);
            failCount++;
        }

        console.log('');

        // Add delay between stories to avoid API rate limits (Imagen 3 has 1 RPM quota)
        if (storyFiles.indexOf(filename) < storyFiles.length - 1) {
            console.log('   ⏳ Waiting 60s to respect API rate limits...');
            await sleep(60000);
        }
    }

    // Summary
    console.log('══════════════════════════════════════════════════════');
    console.log('📊 SEEDING COMPLETE');
    console.log('══════════════════════════════════════════════════════');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed:  ${failCount}`);
    console.log('');
    console.log('   Stories are now visible in the app!');
    console.log('   - Login as Arthur to see his stories');
    console.log('   - Login as Betty to see family stories');
    console.log('══════════════════════════════════════════════════════');

    await client.end();
    console.log('');
    console.log('🏁 Script finished. Exiting...');
    process.exit(0);
}

// Helper: force delete all files in a directory matching a pattern
async function clearStoriesDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        if (file.endsWith('.txt')) {
            fs.unlinkSync(path.join(dirPath, file));
            console.log(`   ✅ Deleted: ${file}`);
        }
    }
}

// Helper: sleep function
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
seedStories().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
