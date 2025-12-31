
import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, boolean, index, pgEnum } from 'drizzle-orm/pg-core';

import { AnyPgColumn } from 'drizzle-orm/pg-core';

// SECURITY: Define role enum for type-safety at DB level
export const userRoleEnum = pgEnum('user_role', ['senior', 'family']);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: userRoleEnum('role').notNull(), // Now uses enum instead of varchar
  seniorId: uuid('senior_id').references((): AnyPgColumn => users.id),
  phoneNumber: varchar('phone_number', { length: 50 }),
  preferences: jsonb('preferences').$type<{
    // Conversation Preferences
    conversationSchedule?: string[];
    voiceTone?: string;
    topicsLove?: string[];
    topicsAvoid?: string[];

    // Biographical Information (for AI context)
    birthYear?: number;
    gender?: 'male' | 'female' | 'other';
    location?: string;  // City/Region
    formerOccupation?: string;
    aboutMe?: string;

    // Family Information
    spouseName?: string;
    childrenCount?: number;
    grandchildrenCount?: number;

    // Memory Context
    favoriteDecade?: string;  // e.g., "1960s", "1970s"
    significantEvents?: string[];  // e.g., ["World War II", "Moon Landing"]

    // Emergency Contact
    emergencyContact?: {
      name: string;
      phoneNumber: string;
      email?: string;
      relationship?: string;
    };
    timezone?: string;
    favoriteChapterIds?: string[]; // IDs of favorited chapters
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    seniorIdIdx: index('users_senior_id_idx').on(table.seniorId),
  }
});

// Sessions Table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  transcriptRaw: jsonb('transcript_raw'), // JSON array of Message[]
  audioUrl: varchar('audio_url', { length: 512 }),
  duration: integer('duration'), // seconds
  status: varchar('status', { length: 50 }).notNull(), // 'active' | 'completed' | 'failed'
  metadata: jsonb('metadata').$type<{
    strategy_usage?: { [key: string]: number };
    avg_response_length?: number;
    sentiment_distribution?: { [key: string]: number };
  }>(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at')
}, (table) => {
  return {
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    // Composite index for dashboard queries: get sessions for user ordered by startedAt
    userStartedAtIdx: index('sessions_user_started_at_idx').on(table.userId, table.startedAt),
  }
});

// Chapters Table
export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  content: text('content').notNull(), // Markdown
  excerpt: text('excerpt').notNull(),
  audioHighlightUrl: varchar('audio_highlight_url', { length: 512 }),
  audioDuration: integer('audio_duration'), // seconds
  pdfUrl: varchar('pdf_url', { length: 512 }),
  // AI-generated story images (stored as base64)
  coverImageData: text('cover_image_data'), // Card thumbnail (4:3)
  bannerImageData: text('banner_image_data'), // Immersive banner (16:9)
  entities: jsonb('entities').$type<Array<{
    type: 'person' | 'place' | 'topic';
    name: string;
    mentions: number;
  }>>(),
  metadata: jsonb('metadata').$type<{
    sessionNumber: number;
    wordCount: number;
    emotionalTone: string;
    lifePeriod?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => {
  return {
    entitiesIdx: index('entities_idx').using('gin', table.entities),
  }
});

// Invitations (Conversations) Table
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  seniorId: uuid('senior_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'sent' | 'answered' | 'missed' | 'cancelled'
  sentAt: timestamp('sent_at'),
  reminderSent: boolean('reminder_sent').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    seniorIdIdx: index('invitations_senior_id_idx').on(table.seniorId),
    seniorStatusIdx: index('invitations_senior_status_idx').on(table.seniorId, table.status),
  }
});

// Alerts Table
export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  seniorId: uuid('senior_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'crisis' | 'decline'
  content: text('content').notNull(),
  triggerPhrase: text('trigger_phrase'),
  severity: varchar('severity', { length: 20 }).notNull(), // 'high' | 'low'
  acknowledged: boolean('acknowledged').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => {
  return {
    seniorIdIdx: index('alerts_senior_id_idx').on(table.seniorId),
  }
});

// Background Jobs Table (optional, if not using BullMQ)
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 100 }).notNull(), // 'chapter_generation', 'entity_extraction'
  status: varchar('status', { length: 50 }).notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  payload: jsonb('payload'),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at')
}, (table) => {
  return {
    statusIdx: index('jobs_status_idx').on(table.status),
    statusCreatedIdx: index('jobs_status_created_idx').on(table.status, table.createdAt),
  }
});

// Storybooks Table - Stores generated storybooks from chapters
export const storybooks = pgTable('storybooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  childrenStory: text('children_story').notNull(),
  atoms: jsonb('atoms').$type<{
    keyMoments?: any[];
    visualElements?: string[];
    narrativeBeats?: any[];
    characterDetails?: any;
  }>(),
  metadata: jsonb('metadata').$type<{
    characterName?: string;
    timePeriod?: string;
    totalPages?: number;
    style?: string;
  }>(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'complete' | 'exported'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    chapterIdIdx: index('storybooks_chapter_id_idx').on(table.chapterId),
    userIdIdx: index('storybooks_user_id_idx').on(table.userId),
  }
});

// Storybook Images Table - Stores generated images for storybook pages
export const storybookImages = pgTable('storybook_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  storybookId: uuid('storybook_id').references(() => storybooks.id, { onDelete: 'cascade' }).notNull(),
  pageNumber: integer('page_number').notNull(),
  imageData: text('image_data').notNull(), // Base64 encoded image
  mimeType: varchar('mime_type', { length: 50 }).notNull(), // 'image/png', 'image/svg+xml'
  prompt: text('prompt').notNull(), // Original generation prompt
  layout: varchar('layout', { length: 50 }).notNull(), // 'full-bleed', 'top-image', etc.
  storyText: text('story_text'), // Text for this page
  metadata: jsonb('metadata').$type<{
    model?: string;
    seed?: number;
    moment?: string;
    visualElements?: string[];
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => {
  return {
    storybookIdIdx: index('storybook_images_storybook_id_idx').on(table.storybookId),
    storybookPageIdx: index('storybook_images_page_idx').on(table.storybookId, table.pageNumber),
  }
});

// Pending Audio Table - Stores audio recordings when Vertex AI is unavailable
// These can be processed later when credits are restored
export const pendingAudio = pgTable('pending_audio', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  audioUrl: varchar('audio_url', { length: 512 }).notNull(), // Supabase Storage URL
  audioSize: integer('audio_size'), // bytes
  audioDuration: integer('audio_duration'), // seconds (estimated)
  mimeType: varchar('mime_type', { length: 100 }), // 'audio/webm', 'audio/wav'
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),
  transcript: text('transcript'), // Filled after processing
  chapterId: uuid('chapter_id').references(() => chapters.id), // Filled after processing
  error: text('error'), // If processing failed
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => {
  return {
    userIdIdx: index('pending_audio_user_id_idx').on(table.userId),
    sessionIdIdx: index('pending_audio_session_id_idx').on(table.sessionId),
    processedIdx: index('pending_audio_processed_idx').on(table.processed),
  }
});
