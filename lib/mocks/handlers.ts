
import { http, HttpResponse } from 'msw';
import { mockUsers, mockSessions, mockChapters } from './data';

export const handlers = [
  // Get user by ID
  http.get('/api/users/:id', ({ params }) => {
    const user = mockUsers.find((u) => u.id === params.id);
    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  // Start conversation session
  http.post('/api/sessions/start', async () => {
    const newSession = {
      sessionId: `session-${Date.now()}`,
      startedAt: new Date().toISOString()
    };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return HttpResponse.json(newSession);
  }),

  // Send message in conversation
  http.post('/api/sessions/:id/messages', async ({ request, params }) => {
    const body: any = await request.json();

    // Mock agent response based on user message
    const agentResponse = {
      id: `msg-${Date.now()}`,
      speaker: 'agent',
      text: mockAgentResponse(body?.message || ''),
      timestamp: new Date().toISOString()
    };

    // Simulate thinking time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return HttpResponse.json(agentResponse);
  }),

  // End conversation and generate chapter
  http.post('/api/sessions/:id/end', async () => {
    // Simulate chapter generation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return HttpResponse.json({
      success: true,
      chapterId: `chapter-${Date.now()}`
    });
  }),

  // Get all chapters for user
  http.get('/api/users/:userId/chapters', ({ params }) => {
    return HttpResponse.json(mockChapters);
  }),

  // Get single chapter
  http.get('/api/chapters/detail/:id', ({ params }) => {
    const chapter = mockChapters.find((c) => c.id === params.id);
    if (!chapter) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(chapter);
  })
];

// Mock agent response generator
function mockAgentResponse(userMessage: string): string {
  const responses = [
    "That's a wonderful memory. Can you tell me more about what that was like?",
    "I can almost picture it. What stands out most to you about that time?",
    "That's really interesting. How did that make you feel?",
    "I'd love to hear more details. What else do you remember?",
    "That sounds special. Who else was there with you?"
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}
