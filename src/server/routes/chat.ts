import { Router, Request, Response } from 'express';
import { createChatService, ChatService } from '../../services/chat.js';
import type { StreamChunk } from '../../types/index.js';

const router = Router();

// Store chat services per session (simple in-memory for session-only)
const sessions = new Map<string, ChatService>();

function getOrCreateSession(sessionId: string): ChatService {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createChatService());
  }
  return sessions.get(sessionId)!;
}

// SSE endpoint for chat
router.post('/chat', async (req: Request, res: Response) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const chatService = getOrCreateSession(sessionId);

  try {
    await chatService.sendMessage(message, (chunk: StreamChunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });
  } catch (error) {
    const errorChunk: StreamChunk = {
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error',
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
  }

  res.end();
});

// Get chat history
router.get('/chat/history', (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const chatService = getOrCreateSession(sessionId);
  res.json({ messages: chatService.getMessages() });
});

// Clear chat history
router.delete('/chat/history', (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const chatService = getOrCreateSession(sessionId);
  chatService.clearMessages();
  res.json({ success: true });
});

export default router;
