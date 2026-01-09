# Learning Chat UI Implementation Plan

## Overview

Build a local web-based chat interface in TypeScript/React that wraps OpenAI's GPT-5.2 for learning and Q&A. The system intelligently evaluates each response using GPT-4o to determine if a visual UI would help explain the content, and if so, generates an interactive HTML component using GPT-5-mini that renders inline in the chat.

## Current State Analysis

- **Fresh project**: No existing source code, package.json, or TypeScript configuration
- **Existing**: `.env` file with `OPENAI_API_KEY` already present
- **No dependencies** installed yet

### Key Discoveries:
- OpenAI SDK auto-reads `OPENAI_API_KEY` from environment
- GPT-5.2 is the latest flagship model (Dec 2025)
- GPT-5-mini is available for cost-effective generation
- SSE is the recommended streaming approach (used by OpenAI natively)
- Sandboxed iframes with `srcdoc` are the secure standard for inline HTML rendering

## Desired End State

A fully functional local chat application where:
1. User sends a question via React chat UI
2. GPT-5.2 streams a learning-focused response
3. GPT-4o evaluates if a visual UI would help explain the response
4. If yes, GPT-5-mini generates interactive HTML rendered inline via sandboxed iframe
5. All conversations are session-only (cleared on refresh)

### Verification:
- `npm run build` succeeds without errors
- `npm run dev` starts the server on localhost:3000
- User can send messages and receive streamed responses
- UI components render inline when appropriate
- No TypeScript errors, no console errors

## What We're NOT Doing

- Conversation persistence/database storage
- User authentication
- Multiple chat sessions
- File uploads or image generation
- Production deployment configuration
- Markdown rendering in responses (can be added later)

## Implementation Approach

We'll build this in 5 phases, starting with project scaffolding, then backend services, then the streaming API, then the React frontend, and finally the UI generation pipeline.

**Tech Stack:**
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Backend**: Express.js with SSE
- **Frontend**: React 18 with Vite
- **Styling**: CSS Modules (simple, no extra deps)
- **OpenAI**: `openai` npm package (latest)

---

## Phase 1: Project Scaffolding

### Overview
Set up the TypeScript project structure, dependencies, and configuration files.

### Changes Required:

#### 1. Package Configuration
**File**: `package.json`

```json
{
  "name": "generative-learning-chat",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch src/index.ts",
    "dev:client": "vite",
    "build": "tsc && vite build",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openai": "^4.77.0",
    "express": "^4.21.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "concurrently": "^9.1.0"
  }
}
```

#### 2. TypeScript Configuration
**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3. Vite Configuration
**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

#### 4. Directory Structure
Create the following directories:

```
src/
├── index.ts
├── config/
│   └── index.ts
├── services/
│   ├── openai.ts
│   ├── chat.ts
│   ├── ui-evaluator.ts
│   └── html-generator.ts
├── server/
│   ├── index.ts
│   └── routes/
│       └── chat.ts
├── types/
│   └── index.ts
└── client/
    ├── index.html
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    └── components/
        ├── ChatMessage.tsx
        ├── ChatMessage.css
        ├── ChatInput.tsx
        ├── ChatInput.css
        ├── HtmlPreview.tsx
        └── HtmlPreview.css
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm install` completes without errors
- [ ] `npm run typecheck` passes with no errors
- [ ] Directory structure matches the specification

#### Manual Verification:
- [ ] `.env` file contains `OPENAI_API_KEY`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Backend Services

### Overview
Implement the core backend services: configuration, OpenAI client wrapper, and TypeScript types.

### Changes Required:

#### 1. TypeScript Types
**File**: `src/types/index.ts`

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string; // Optional generated HTML UI
  timestamp: number;
}

export interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error';
  data: string;
}

export interface UIEvaluationResult {
  shouldGenerateUI: boolean;
  reason: string;
  suggestedUIType?: string;
}

export interface ConversationContext {
  messages: ChatMessage[];
}
```

#### 2. Configuration Module
**File**: `src/config/index.ts`

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  models: {
    chat: 'gpt-5.2',
    evaluation: 'gpt-4o',
    htmlGeneration: 'gpt-5-mini',
  },
} as const;

// Validate required config
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required in .env file');
}
```

#### 3. OpenAI Service
**File**: `src/services/openai.ts`

```typescript
import OpenAI from 'openai';
import { config } from '../config/index.js';

const client = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface StreamOptions {
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  onChunk: (content: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
}

/**
 * Stream a chat completion response
 */
export async function streamChat(options: StreamOptions): Promise<void> {
  const { model, messages, onChunk, onComplete, onError } = options;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    onComplete(fullContent);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Quick non-streaming completion for evaluation
 */
export async function quickCompletion(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages,
  });

  return response.choices[0]?.message?.content || '';
}

export { client };
```

#### 4. UI Evaluator Service
**File**: `src/services/ui-evaluator.ts`

```typescript
import { quickCompletion } from './openai.js';
import { config } from '../config/index.js';
import type { UIEvaluationResult } from '../types/index.js';

const EVALUATION_PROMPT = `You are an assistant that evaluates whether a visual UI component would help explain an AI response to a user.

Analyze the following AI response and determine if a visual UI accompaniment would be helpful.

Consider generating a UI when:
- The response contains a lot of text that could be better organized visually
- The response explains a concept that would benefit from visualization (diagrams, flowcharts)
- The response includes step-by-step instructions (interactive checklist)
- The response contains data, lists, or comparisons (tables, charts)
- The response explains code or algorithms (visual representation)
- The response teaches a concept that would benefit from an interactive example

Do NOT generate a UI for:
- Simple, short answers
- Direct factual responses
- Responses that are already concise and clear
- Conversational/casual exchanges

Respond in JSON format:
{
  "shouldGenerateUI": true/false,
  "reason": "Brief explanation of your decision",
  "suggestedUIType": "One of: checklist, diagram, table, interactive-demo, visualization, code-playground, or null if no UI"
}`;

export async function evaluateForUI(
  assistantResponse: string
): Promise<UIEvaluationResult> {
  try {
    const response = await quickCompletion(config.models.evaluation, [
      { role: 'system', content: EVALUATION_PROMPT },
      { role: 'user', content: `AI Response to evaluate:\n\n${assistantResponse}` },
    ]);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { shouldGenerateUI: false, reason: 'Failed to parse evaluation' };
    }

    const result = JSON.parse(jsonMatch[0]) as UIEvaluationResult;
    return result;
  } catch (error) {
    console.error('UI evaluation error:', error);
    return { shouldGenerateUI: false, reason: 'Evaluation failed' };
  }
}
```

#### 5. HTML Generator Service
**File**: `src/services/html-generator.ts`

```typescript
import { quickCompletion } from './openai.js';
import { config } from '../config/index.js';

const GENERATION_PROMPT = `You are an expert at creating simple, interactive HTML components that help explain concepts.

Generate a single, self-contained HTML document that visualizes or makes interactive the concept from the AI response.

Requirements:
- Output ONLY valid HTML (no markdown, no code blocks)
- Include all CSS in a <style> tag in the head
- Include all JavaScript in a <script> tag at the end of body
- Keep it simple and focused on clarity
- Use modern CSS (flexbox, grid) for layout
- Make it visually appealing with good contrast and spacing
- If interactive, ensure it works with vanilla JavaScript
- Maximum ~200 lines of code
- Do not include external dependencies or CDN links
- Use a clean, modern design with a white/light background

The HTML will be rendered in a sandboxed iframe, so:
- No access to parent window
- No external resources
- Must be fully self-contained`;

export async function generateHTML(
  assistantResponse: string,
  suggestedUIType: string | undefined
): Promise<string> {
  const typeHint = suggestedUIType
    ? `\n\nSuggested UI type: ${suggestedUIType}`
    : '';

  const response = await quickCompletion(config.models.htmlGeneration, [
    { role: 'system', content: GENERATION_PROMPT },
    {
      role: 'user',
      content: `Create an HTML UI to help explain this response:

${assistantResponse}${typeHint}`
    },
  ]);

  // Clean up response - remove markdown code blocks if present
  let html = response.trim();
  if (html.startsWith('```html')) {
    html = html.slice(7);
  } else if (html.startsWith('```')) {
    html = html.slice(3);
  }
  if (html.endsWith('```')) {
    html = html.slice(0, -3);
  }

  return html.trim();
}
```

#### 6. Chat Service (Orchestration)
**File**: `src/services/chat.ts`

```typescript
import { streamChat } from './openai.js';
import { evaluateForUI } from './ui-evaluator.js';
import { generateHTML } from './html-generator.js';
import { config } from '../config/index.js';
import type { ChatMessage, StreamChunk } from '../types/index.js';

const SYSTEM_PROMPT = `You are a helpful learning assistant. Your goal is to explain concepts clearly and thoroughly to help users understand and learn.

When answering:
- Be thorough but organized
- Use examples when helpful
- Break down complex topics into digestible parts
- Encourage further questions`;

export class ChatService {
  private messages: ChatMessage[] = [];

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  async sendMessage(
    userContent: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatMessage> {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    this.messages.push(userMessage);

    // Prepare conversation for API
    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...this.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Stream the response
    let assistantContent = '';

    await new Promise<void>((resolve, reject) => {
      streamChat({
        model: config.models.chat,
        messages: apiMessages,
        onChunk: (content) => {
          assistantContent += content;
          onChunk({ type: 'content', data: content });
        },
        onComplete: () => resolve(),
        onError: (error) => reject(error),
      });
    });

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
    };

    // Evaluate if UI would help
    const evaluation = await evaluateForUI(assistantContent);

    if (evaluation.shouldGenerateUI) {
      try {
        const html = await generateHTML(
          assistantContent,
          evaluation.suggestedUIType
        );
        assistantMessage.htmlUI = html;
        onChunk({ type: 'ui', data: html });
      } catch (error) {
        console.error('HTML generation failed:', error);
      }
    }

    // Signal completion
    onChunk({ type: 'done', data: '' });

    this.messages.push(assistantMessage);
    return assistantMessage;
  }
}

// Singleton instance per session would be created at route level
export function createChatService(): ChatService {
  return new ChatService();
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run typecheck` passes with no errors
- [ ] All service files compile successfully

#### Manual Verification:
- [ ] Service logic makes sense for the use case

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Express Server & SSE API

### Overview
Set up the Express server with SSE streaming endpoint for chat.

### Changes Required:

#### 1. Chat Routes
**File**: `src/server/routes/chat.ts`

```typescript
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
```

#### 2. Server Setup
**File**: `src/server/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes/chat.js';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', chatRoutes);

  // Serve static files in production
  const clientPath = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientPath, 'index.html'));
    }
  });

  return app;
}

export function startServer() {
  const app = createServer();

  app.listen(config.server.port, () => {
    console.log(`Server running at http://localhost:${config.server.port}`);
  });

  return app;
}
```

#### 3. Entry Point
**File**: `src/index.ts`

```typescript
import { startServer } from './server/index.js';

startServer();
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run typecheck` passes
- [ ] `npm run dev:server` starts without errors
- [ ] `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"Hello"}'` returns SSE stream

#### Manual Verification:
- [ ] Server logs show successful startup message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: React Frontend

### Overview
Build the React chat interface with streaming message display and sandboxed iframe rendering.

### Changes Required:

#### 1. HTML Entry Point
**File**: `src/client/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Learning Chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

#### 2. React Entry Point
**File**: `src/client/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### 3. Main App Component
**File**: `src/client/App.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  isStreaming?: boolean;
}

interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error';
  data: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    // Add placeholder for assistant message
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));

              if (chunk.type === 'content') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + chunk.data }
                      : m
                  )
                );
              } else if (chunk.type === 'ui') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, htmlUI: chunk.data } : m
                  )
                );
              } else if (chunk.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  )
                );
              } else if (chunk.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: `Error: ${chunk.data}`,
                          isStreaming: false,
                        }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    fetch('/api/chat/history', { method: 'DELETE' });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Learning Chat</h1>
        <button onClick={clearChat} className="clear-btn">
          Clear Chat
        </button>
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Ask me anything! I'm here to help you learn.</p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
```

#### 4. App Styles
**File**: `src/client/App.css`

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 900px;
  margin: 0 auto;
  background: white;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
  background: #fff;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
}

.clear-btn {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.clear-btn:hover {
  background: #e0e0e0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
  font-size: 1.1rem;
}
```

#### 5. ChatMessage Component
**File**: `src/client/components/ChatMessage.tsx`

```tsx
import React from 'react';
import HtmlPreview from './HtmlPreview';
import './ChatMessage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  isStreaming?: boolean;
}

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {message.content}
          {message.isStreaming && <span className="cursor">▊</span>}
        </div>
        {message.htmlUI && (
          <div className="message-ui">
            <HtmlPreview html={message.htmlUI} />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 6. ChatMessage Styles
**File**: `src/client/components/ChatMessage.css`

```css
.message {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #e3f2fd;
}

.message-content {
  max-width: 80%;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  padding: 12px 16px;
  border-radius: 12px;
  background: #f5f5f5;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.user .message-text {
  background: #2196f3;
  color: white;
}

.message-ui {
  margin-top: 12px;
}

.cursor {
  animation: blink 1s infinite;
  color: #2196f3;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

#### 7. ChatInput Component
**File**: `src/client/components/ChatInput.tsx`

```tsx
import React, { useState, KeyboardEvent } from 'react';
import './ChatInput.css';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your question..."
        disabled={disabled}
        rows={1}
      />
      <button onClick={handleSubmit} disabled={disabled || !input.trim()}>
        {disabled ? '...' : 'Send'}
      </button>
    </div>
  );
}
```

#### 8. ChatInput Styles
**File**: `src/client/components/ChatInput.css`

```css
.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.chat-input textarea {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  resize: none;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input textarea:focus {
  border-color: #2196f3;
}

.chat-input textarea:disabled {
  background: #f5f5f5;
}

.chat-input button {
  padding: 12px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background: #1976d2;
}

.chat-input button:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
}
```

#### 9. HtmlPreview Component (Sandboxed iframe)
**File**: `src/client/components/HtmlPreview.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import './HtmlPreview.css';

interface Props {
  html: string;
}

export default function HtmlPreview({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  // Inject resize script into HTML
  const htmlWithResize = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        </style>
      </head>
      <body>
        ${html.includes('<body') ? html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html : html}
        <script>
          function sendHeight() {
            const height = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight
            );
            window.parent.postMessage({ type: 'resize', height: height + 32 }, '*');
          }

          // Send height on load and resize
          window.addEventListener('load', sendHeight);
          window.addEventListener('resize', sendHeight);

          // Observe DOM changes
          new MutationObserver(sendHeight).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });

          // Initial send
          setTimeout(sendHeight, 100);
        <\/script>
      </body>
    </html>
  `;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        setHeight(Math.min(event.data.height, 600)); // Max height 600px
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="html-preview">
      <div className="preview-header">
        <span>Interactive Preview</span>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={htmlWithResize}
        sandbox="allow-scripts"
        style={{ height: `${height}px` }}
        title="Generated UI Preview"
      />
    </div>
  );
}
```

#### 10. HtmlPreview Styles
**File**: `src/client/components/HtmlPreview.css`

```css
.html-preview {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.preview-header {
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.html-preview iframe {
  width: 100%;
  border: none;
  display: block;
  min-height: 100px;
  transition: height 0.2s ease;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run typecheck` passes
- [ ] `npm run dev` starts both server and client without errors
- [ ] `npm run build` completes successfully

#### Manual Verification:
- [ ] Chat UI loads at http://localhost:5173
- [ ] User can type and send messages
- [ ] Responses stream in character by character
- [ ] Clear Chat button works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Integration Testing & Polish

### Overview
Test the full flow end-to-end and ensure UI generation works correctly.

### Changes Required:

#### 1. Update .gitignore
**File**: `.gitignore`

```
node_modules/
dist/
.env
*.log
.DS_Store
```

#### 2. Update README
**File**: `README.md`

```markdown
# Learning Chat

A local AI-powered chat interface for learning and Q&A. Built with TypeScript, React, and OpenAI's GPT models.

## Features

- Chat with GPT-5.2 for learning and explanations
- Intelligent UI generation: GPT-4o evaluates responses and GPT-5-mini generates interactive HTML components when helpful
- Streaming responses for real-time feedback
- Session-based conversations (cleared on refresh)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your-key-here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173 in your browser

## Scripts

- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run typecheck` - Check TypeScript types

## Architecture

- **Backend**: Express.js with SSE streaming
- **Frontend**: React 18 with Vite
- **AI Models**:
  - GPT-5.2: Main chat responses
  - GPT-4o: Evaluates if UI would help
  - GPT-5-mini: Generates interactive HTML
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] No console errors in browser

#### Manual Verification:
- [ ] Full flow works: send question → get streamed response → UI appears when appropriate
- [ ] Generated UI is interactive and renders correctly in iframe
- [ ] UI evaluator correctly decides when to generate UI (e.g., "explain how sorting works" should trigger UI)
- [ ] Simple questions (e.g., "what is 2+2") should NOT trigger UI generation

**Implementation Note**: After completing this phase, the implementation is complete.

---

## Testing Strategy

### Manual Testing Steps:
1. Start the app with `npm run dev`
2. Ask a simple factual question: "What is the capital of France?"
   - Expected: Text response only, no UI
3. Ask a conceptual question: "Explain how a binary search algorithm works step by step"
   - Expected: Text response + interactive visualization
4. Ask for a comparison: "Compare React, Vue, and Angular frameworks"
   - Expected: Text response + table or comparison UI
5. Ask for instructions: "How do I set up a new Node.js project?"
   - Expected: Text response + checklist UI
6. Test streaming: Ask a long question and observe real-time character display
7. Test Clear Chat: Click button and verify messages are cleared

### Edge Cases to Test:
- Empty message submission (should be blocked)
- Very long responses (should still stream correctly)
- API errors (should display error message)
- Rapid message sending (should queue properly)

## Performance Considerations

- **Streaming**: Reduces perceived latency for long responses
- **Iframe sandboxing**: Prevents malicious code execution
- **Session-only storage**: No database overhead
- **Parallel model calls**: UI evaluation happens after main response completes (not blocking UX)

## Future Enhancements (Out of Scope)

- Markdown rendering in responses
- Conversation persistence
- Multiple chat sessions
- Export chat history
- Custom system prompts
- Image generation/upload support

## References

- OpenAI Node.js SDK: https://github.com/openai/openai-node
- Express SSE patterns: https://github.com/openai/openai-node/blob/master/examples/stream-to-client-express.ts
- Sandboxed iframes: https://web.dev/articles/sandboxed-iframes
