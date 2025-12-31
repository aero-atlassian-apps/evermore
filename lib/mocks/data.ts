
import { User } from '@/lib/core/domain/entities/User';
import { Session as ConversationSession } from '@/lib/core/domain/entities/Session';
import { Chapter } from '@/lib/core/domain/entities/Chapter';

export const mockUsers: User[] = [
  {
    id: 'user-arthur',
    name: 'Arthur Thompson',
    email: 'arthur@example.com',
    role: 'senior',
    createdAt: new Date('2025-12-01')
  },
  {
    id: 'user-sarah',
    name: 'Sarah Thompson',
    email: 'sarah@example.com',
    role: 'family',
    seniorId: 'user-arthur',
    createdAt: new Date('2025-12-01')
  }
];

export const mockSessions: ConversationSession[] = [
  new ConversationSession(
    'session-001',
    'user-arthur',
    JSON.stringify([
      {
        id: 'msg-001',
        speaker: 'agent',
        text: "Hi Arthur, it's wonderful to talk with you today. What's been on your mind lately?",
        timestamp: new Date('2025-12-10T10:00:00')
      },
      {
        id: 'msg-002',
        speaker: 'user',
        text: "Oh, I was just thinking about my first job at the Ford plant.",
        timestamp: new Date('2025-12-10T10:00:15')
      },
      {
        id: 'msg-003',
        speaker: 'agent',
        text: "The Ford plant — that sounds like an important place in your life. What did the factory floor smell like when you first walked in?",
        timestamp: new Date('2025-12-10T10:00:30')
      }
    ]),
    'completed',
    new Date('2025-12-10T10:00:00'),
    undefined,
    1380, // 23 minutes
    new Date('2025-12-10T10:23:00'),
    {}
  )
];

export const mockChapters: Chapter[] = [
  new Chapter(
    'chapter-001',
    'session-001',
    'user-arthur',
    "The Ford Plant: Arthur's First Real Job",
    `In 1952, at eighteen years old, Arthur walked through the doors of the Ford plant on 5th Street for the first time. He'd just finished high school, and his father had arranged the interview through a connection with the foreman, Bill. The job was simple on paper—mechanic's apprentice—but Arthur remembers it as the moment he became a man.

"The smell hit you first," Arthur recalls. *"Motor oil, hot metal, cigarette smoke all mixed together. It was deafening—presses banging, engines roaring. But I loved it. I felt like I was part of something big."*

Bill took Arthur under his wing that first week. He was patient, Arthur says, never making him feel stupid for asking questions. They worked side by side on the assembly line, and Arthur learned not just how to fix engines, but how to work with his hands and take pride in a job well done.

The Ford plant would become Arthur's second home for the next forty years. But that first day—the noise, the smell, the handshake from Bill—that was the day Arthur stopped being a kid and started building the life he'd look back on with pride.`,
    "In 1952, at eighteen years old, Arthur walked through the doors of the Ford plant on 5th Street for the first time...",
    new Date('2025-12-10T10:30:00'),
    '/mock-audio/chapter-001-highlight.mp3',
    154, // 2:34
    '/mock-pdfs/chapter-001.pdf',
    [
      { type: 'person', name: 'Bill (foreman)', mentions: 3 },
      { type: 'person', name: 'Father', mentions: 1 },
      { type: 'place', name: 'Ford plant, 5th Street', mentions: 5 },
      { type: 'topic', name: 'First job', mentions: 2 }
    ],
    {
      sessionNumber: 1,
      wordCount: 211,
      emotionalTone: 'positive',
      lifePeriod: '1950s'
    }
  ),
  new Chapter(
    'chapter-002',
    'session-002',
    'user-arthur',
    "Navy Days: Seeing the World at Nineteen",
    `Arthur enlisted in the Navy in 1953, just a year after starting at the Ford plant. "I wanted adventure," he says with a chuckle. *"Working on the factory floor was good money, but I wanted to see what was out there beyond our little town."*

His first deployment took him to the Pacific. Arthur remembers standing on the deck of the destroyer, watching dolphins race alongside the ship. The ocean stretched endlessly in every direction, and for the first time in his life, Arthur felt truly free...`,
    "Arthur enlisted in the Navy in 1953, just a year after starting at the Ford plant...",
    new Date('2025-12-08T14:45:00'),
    '/mock-audio/chapter-002-highlight.mp3',
    118,
    undefined,
    [
      { type: 'topic', name: 'Navy service', mentions: 8 },
      { type: 'place', name: 'Pacific Ocean', mentions: 3 }
    ],
    {
      sessionNumber: 2,
      wordCount: 187,
      emotionalTone: 'positive',
      lifePeriod: '1950s'
    }
  )
];
