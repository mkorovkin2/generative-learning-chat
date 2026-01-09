# SQLite Chat Persistence & Sidebar Implementation Plan

## Overview

Add persistent chat storage using SQLite with a selectable chat sidebar. Visualizations will be stored as separate HTML files on the filesystem with database references. Missing visualization files will display a "Visualization unavailable" message.

## Current State Analysis

**What exists:**
- In-memory session storage via `Map<string, ChatService>` (`src/server/routes/chat.ts:8`)
- Messages stored in `ChatService.messages` array (`src/services/chat.ts:16`)
- Visualizations stored as `htmlUI` string field on messages
- Single-column layout with no sidebar (`src/client/App.css`)
- No database or persistent storage

**Key constraints:**
- Must preserve existing SSE streaming architecture
- Branch chat functionality must continue to work
- Visualization generation pipeline unchanged (just storage location changes)

## Desired End State

After implementation:
1. All **main chats** and messages persist in SQLite database at `./data/chat.db`
2. **Branch chats (text selection chats) are NOT saved** - they remain ephemeral/in-memory only
3. Visualizations stored as HTML files at `./data/visualizations/{id}.html`
4. Sidebar on left side showing chat list with title + timestamp
5. "New Chat" button creates new conversations
6. Clicking a chat fully reloads that conversation
7. Missing visualization files show "Visualization unavailable" message

**Verification:**
- Refresh browser → chats persist
- Restart server → chats persist
- Delete a visualization file → shows "unavailable" message
- Create multiple chats → all appear in sidebar
- Click different chat → fully reloads messages

## What We're NOT Doing

- No user authentication (chats are local/single-user)
- No chat renaming/editing UI
- No chat deletion UI (can add later)
- No visualization regeneration button
- No search functionality
- No pagination for chat list (can add later if needed)
- **No persistence for branch chats** - text selection popup chats remain in-memory only and are discarded when closed

## Implementation Approach

Use `better-sqlite3` for synchronous SQLite operations (simpler for this use case). Store visualizations as separate files to keep database size manageable and allow easy debugging. Frontend will use a new layout with fixed-width sidebar.

---

## Phase 1: Database & File Storage Setup

### Overview
Set up SQLite database, create schema, and establish visualization file storage directory.

### Changes Required:

#### 1. Add Dependencies
**File**: `package.json`
**Changes**: Add better-sqlite3 dependency

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

#### 2. Create Database Service
**File**: `src/services/database.ts` (new file)
**Changes**: Create SQLite database wrapper with schema initialization

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = './data';
const DB_PATH = path.join(DATA_DIR, 'chat.db');
const VIZ_DIR = path.join(DATA_DIR, 'visualizations');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VIZ_DIR)) {
  fs.mkdirSync(VIZ_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    visualization_id TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
`);

export interface ChatRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  visualization_id: string | null;
  timestamp: number;
}

// Chat operations
export function createChat(id: string, title: string): ChatRow {
  const now = Date.now();
  const stmt = db.prepare(
    'INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(id, title, now, now);
  return { id, title, created_at: now, updated_at: now };
}

export function getChat(id: string): ChatRow | undefined {
  const stmt = db.prepare('SELECT * FROM chats WHERE id = ?');
  return stmt.get(id) as ChatRow | undefined;
}

export function getAllChats(): ChatRow[] {
  const stmt = db.prepare('SELECT * FROM chats ORDER BY updated_at DESC');
  return stmt.all() as ChatRow[];
}

export function updateChatTimestamp(id: string): void {
  const stmt = db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?');
  stmt.run(Date.now(), id);
}

export function deleteChat(id: string): void {
  // Messages will be deleted via CASCADE
  const stmt = db.prepare('DELETE FROM chats WHERE id = ?');
  stmt.run(id);
}

// Message operations
export function addMessage(
  id: string,
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  visualizationId: string | null = null
): MessageRow {
  const timestamp = Date.now();
  const stmt = db.prepare(
    'INSERT INTO messages (id, chat_id, role, content, visualization_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(id, chatId, role, content, visualizationId, timestamp);
  updateChatTimestamp(chatId);
  return { id, chat_id: chatId, role, content, visualization_id: visualizationId, timestamp };
}

export function getMessagesByChatId(chatId: string): MessageRow[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC');
  return stmt.all(chatId) as MessageRow[];
}

export function updateMessageVisualization(messageId: string, visualizationId: string): void {
  const stmt = db.prepare('UPDATE messages SET visualization_id = ? WHERE id = ?');
  stmt.run(visualizationId, messageId);
}

export function clearMessagesByChatId(chatId: string): void {
  const stmt = db.prepare('DELETE FROM messages WHERE chat_id = ?');
  stmt.run(chatId);
}

// Visualization file operations
export function getVisualizationPath(id: string): string {
  return path.join(VIZ_DIR, `${id}.html`);
}

export function saveVisualization(id: string, html: string): void {
  const filePath = getVisualizationPath(id);
  fs.writeFileSync(filePath, html, 'utf-8');
}

export function loadVisualization(id: string): string | null {
  const filePath = getVisualizationPath(id);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

export function deleteVisualization(id: string): void {
  const filePath = getVisualizationPath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export { db, VIZ_DIR };
```

#### 3. Add data directory to .gitignore
**File**: `.gitignore`
**Changes**: Add data directory

```
# Database and visualizations
/data/
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Server starts without errors: `npm run dev:server`

#### Manual Verification:
- [ ] `./data/chat.db` file is created on server start
- [ ] `./data/visualizations/` directory is created on server start

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Backend API Updates

### Overview
Update chat routes to use SQLite persistence. Add new endpoints for chat management and visualization file serving.

### Changes Required:

#### 1. Update Chat Types
**File**: `src/types/index.ts`
**Changes**: Add chat list types

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  visualizationId?: string;  // Add this field
  timestamp: number;
}

export interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error' | 'status';
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

// Add new types
export interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatWithMessages {
  chat: ChatSummary;
  messages: ChatMessage[];
}
```

#### 2. Update ChatService to Use Database
**File**: `src/services/chat.ts`
**Changes**: Replace in-memory storage with database calls. **Important**: Branch chats (IDs starting with `branch-`) use in-memory storage only and are NOT persisted.

```typescript
import { streamChat } from './openai.js';
import { evaluateForUI } from './ui-evaluator.js';
import { generateHTML } from './html-generator.js';
import { config } from '../config/index.js';
import type { ChatMessage, StreamChunk } from '../types/index.js';
import * as db from './database.js';

const SYSTEM_PROMPT = `You are a helpful learning assistant. Your goal is to explain concepts clearly and thoroughly to help users understand and learn.

When answering:
- Be thorough but organized
- Use examples when helpful
- Break down complex topics into digestible parts
- Encourage further questions`;

// Helper to check if a chat is a branch chat (ephemeral, not saved)
function isBranchChat(chatId: string): boolean {
  return chatId.startsWith('branch-');
}

export class ChatService {
  private chatId: string;
  private ephemeral: boolean;
  private inMemoryMessages: ChatMessage[] = []; // For branch chats only

  constructor(chatId: string, ephemeral: boolean = false) {
    this.chatId = chatId;
    this.ephemeral = ephemeral;
  }

  getChatId(): string {
    return this.chatId;
  }

  isEphemeral(): boolean {
    return this.ephemeral;
  }

  getMessages(): ChatMessage[] {
    // Branch chats use in-memory storage
    if (this.ephemeral) {
      return [...this.inMemoryMessages];
    }

    // Main chats use database
    const rows = db.getMessagesByChatId(this.chatId);
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      visualizationId: row.visualization_id || undefined,
      htmlUI: row.visualization_id ? db.loadVisualization(row.visualization_id) || undefined : undefined,
      timestamp: row.timestamp,
    }));
  }

  clearMessages(): void {
    // Branch chats just clear in-memory
    if (this.ephemeral) {
      this.inMemoryMessages = [];
      return;
    }

    // Main chats delete from database and clean up visualization files
    const messages = db.getMessagesByChatId(this.chatId);
    for (const msg of messages) {
      if (msg.visualization_id) {
        db.deleteVisualization(msg.visualization_id);
      }
    }
    db.clearMessagesByChatId(this.chatId);
  }

  async sendMessage(
    userContent: string,
    onChunk: (chunk: StreamChunk) => void,
    options: { skipUI?: boolean } = {}
  ): Promise<ChatMessage> {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };

    // Store user message (in-memory for branch chats, database for main chats)
    if (this.ephemeral) {
      this.inMemoryMessages.push(userMessage);
    } else {
      db.addMessage(userMessage.id, this.chatId, 'user', userContent);
    }

    // Prepare conversation for API
    const allMessages = this.getMessages();
    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...allMessages.map((m) => ({
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
        webSearch: true,
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

    // Evaluate if UI would help (skip for branch chats - they always have skipUI=true)
    let visualizationId: string | undefined;
    if (!options.skipUI && !this.ephemeral) {
      onChunk({ type: 'status', data: 'Analyzing response...' });
      const evaluation = await evaluateForUI(assistantContent);

      if (evaluation.shouldGenerateUI) {
        try {
          onChunk({ type: 'status', data: 'Creating interactive visualization...' });
          const html = await generateHTML(
            assistantContent,
            evaluation.suggestedUIType
          );

          // Save visualization to file (only for persisted chats)
          visualizationId = crypto.randomUUID();
          db.saveVisualization(visualizationId, html);

          assistantMessage.htmlUI = html;
          assistantMessage.visualizationId = visualizationId;
          onChunk({ type: 'ui', data: html });
        } catch (error) {
          console.error('HTML generation failed:', error);
        }
      }
      onChunk({ type: 'status', data: '' }); // Clear status
    }

    // Signal completion
    onChunk({ type: 'done', data: '' });

    // Store assistant message (in-memory for branch chats, database for main chats)
    if (this.ephemeral) {
      this.inMemoryMessages.push(assistantMessage);
    } else {
      db.addMessage(
        assistantMessage.id,
        this.chatId,
        'assistant',
        assistantContent,
        visualizationId || null
      );
    }

    return assistantMessage;
  }
}

// Generate title from first message (first 50 chars or first sentence)
function generateTitle(content: string): string {
  const cleaned = content.trim();
  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) {
    return firstSentence;
  }
  return cleaned.substring(0, 47) + '...';
}

export function createChatService(chatId?: string): ChatService {
  const id = chatId || crypto.randomUUID();

  // Branch chats are ephemeral (not saved to database)
  if (isBranchChat(id)) {
    return new ChatService(id, true);
  }

  // Main chats are persisted - create in database if doesn't exist
  if (!db.getChat(id)) {
    db.createChat(id, 'New Chat');
  }

  return new ChatService(id, false);
}

export function getOrCreateChatService(chatId: string, firstMessage?: string): ChatService {
  // Branch chats are ephemeral (not saved to database)
  if (isBranchChat(chatId)) {
    return new ChatService(chatId, true);
  }

  // Main chats are persisted
  const existingChat = db.getChat(chatId);

  if (!existingChat) {
    const title = firstMessage ? generateTitle(firstMessage) : 'New Chat';
    db.createChat(chatId, title);
  }

  return new ChatService(chatId, false);
}

export function updateChatTitle(chatId: string, firstMessage: string): void {
  // Don't update title for branch chats (they're not in database)
  if (isBranchChat(chatId)) {
    return;
  }

  const chat = db.getChat(chatId);
  if (chat && chat.title === 'New Chat') {
    const stmt = db.db.prepare('UPDATE chats SET title = ? WHERE id = ?');
    stmt.run(generateTitle(firstMessage), chatId);
  }
}
```

#### 3. Update Chat Routes
**File**: `src/server/routes/chat.ts`
**Changes**: Add new endpoints, update existing ones

```typescript
import { Router, Request, Response } from 'express';
import { createChatService, getOrCreateChatService, updateChatTitle, ChatService } from '../../services/chat.js';
import * as db from '../../services/database.js';
import type { StreamChunk, ChatSummary, ChatWithMessages, ChatMessage } from '../../types/index.js';

const router = Router();

// Store active chat services (for streaming sessions only)
const activeSessions = new Map<string, ChatService>();

function getOrCreateSession(chatId: string, firstMessage?: string): ChatService {
  if (!activeSessions.has(chatId)) {
    activeSessions.set(chatId, getOrCreateChatService(chatId, firstMessage));
  }
  return activeSessions.get(chatId)!;
}

// Get all chats (for sidebar)
router.get('/chats', (req: Request, res: Response) => {
  const chats = db.getAllChats();
  const chatSummaries: ChatSummary[] = chats.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
  res.json({ chats: chatSummaries });
});

// Get single chat with messages
router.get('/chats/:chatId', (req: Request, res: Response) => {
  const { chatId } = req.params;
  const chat = db.getChat(chatId);

  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const messages = db.getMessagesByChatId(chatId);
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    visualizationId: m.visualization_id || undefined,
    // Load visualization HTML if exists
    htmlUI: m.visualization_id ? db.loadVisualization(m.visualization_id) || undefined : undefined,
    timestamp: m.timestamp,
  }));

  const result: ChatWithMessages = {
    chat: {
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
    },
    messages: chatMessages,
  };

  res.json(result);
});

// Create new chat
router.post('/chats', (req: Request, res: Response) => {
  const id = crypto.randomUUID();
  const chat = db.createChat(id, 'New Chat');
  const chatSummary: ChatSummary = {
    id: chat.id,
    title: chat.title,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
  res.json(chatSummary);
});

// Delete chat
router.delete('/chats/:chatId', (req: Request, res: Response) => {
  const { chatId } = req.params;

  // Delete visualization files
  const messages = db.getMessagesByChatId(chatId);
  for (const msg of messages) {
    if (msg.visualization_id) {
      db.deleteVisualization(msg.visualization_id);
    }
  }

  db.deleteChat(chatId);
  activeSessions.delete(chatId);
  res.json({ success: true });
});

// SSE endpoint for chat
router.post('/chat', async (req: Request, res: Response) => {
  const { message, chatId, skipUI = false } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  if (!chatId || typeof chatId !== 'string') {
    res.status(400).json({ error: 'chatId is required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const chatService = getOrCreateSession(chatId, message);

  // Update chat title if this is the first user message
  updateChatTitle(chatId, message);

  try {
    await chatService.sendMessage(message, (chunk: StreamChunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }, { skipUI });
  } catch (error) {
    const errorChunk: StreamChunk = {
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error',
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
  }

  res.end();
});

// Get chat history (legacy endpoint - now uses chatId)
router.get('/chat/history', (req: Request, res: Response) => {
  const chatId = (req.query.chatId as string) || 'default';
  const chatService = getOrCreateSession(chatId);
  res.json({ messages: chatService.getMessages() });
});

// Clear chat history (legacy endpoint)
router.delete('/chat/history', (req: Request, res: Response) => {
  const chatId = (req.query.chatId as string) || 'default';
  const chatService = getOrCreateSession(chatId);
  chatService.clearMessages();
  res.json({ success: true });
});

export default router;
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [ ] `GET /api/chats` returns empty array initially
- [ ] `POST /api/chats` creates a new chat
- [ ] `GET /api/chats/:id` returns chat with messages
- [ ] `POST /api/chat` with chatId creates messages in database
- [ ] Visualization files are saved to `./data/visualizations/`
- [ ] Server restart preserves all chat data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Frontend Sidebar

### Overview
Add sidebar layout with chat list and "New Chat" button.

### Changes Required:

#### 1. Create ChatSidebar Component
**File**: `src/client/components/ChatSidebar.tsx` (new file)
**Changes**: Create sidebar component

```tsx
import React from 'react';
import './ChatSidebar.css';

interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface Props {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function ChatSidebar({ chats, activeChatId, onSelectChat, onNewChat }: Props) {
  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>
      <div className="chat-list">
        {chats.length === 0 ? (
          <div className="no-chats">No chats yet</div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <span className="chat-title">{chat.title}</span>
              <span className="chat-date">{formatDate(chat.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
```

#### 2. Create ChatSidebar Styles
**File**: `src/client/components/ChatSidebar.css` (new file)
**Changes**: Add sidebar styles

```css
.chat-sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.new-chat-btn {
  width: 100%;
  padding: 10px 16px;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.new-chat-btn:hover {
  background: #333;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.no-chats {
  padding: 24px 16px;
  text-align: center;
  color: #888;
  font-size: 0.9rem;
}

.chat-item {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.chat-item:hover {
  background: #e8e8e8;
}

.chat-item.active {
  background: #e0e0e0;
}

.chat-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-date {
  font-size: 0.75rem;
  color: #888;
}
```

#### 3. Update App Layout
**File**: `src/client/App.css`
**Changes**: Add sidebar layout styles

Replace entire file:

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

.app-container {
  display: flex;
  height: 100vh;
  width: 100%;
}

.app {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100vh;
  max-width: 900px;
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

/* Responsive: hide sidebar on small screens */
@media (max-width: 768px) {
  .chat-sidebar {
    display: none;
  }

  .app {
    max-width: 100%;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [ ] Sidebar appears on left side of screen
- [ ] "New Chat" button is visible in sidebar header
- [ ] Sidebar styles look correct (280px width, proper colors)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Frontend Chat Integration

### Overview
Wire up chat selection, fully reload chats, and handle missing visualizations.

### Changes Required:

#### 1. Update HtmlPreview for Missing Visualizations
**File**: `src/client/components/HtmlPreview.tsx`
**Changes**: Add handling for missing visualization state

First read the current file, then add this case at the start of the component:

```tsx
// Add this check at the beginning of the component function
if (!html) {
  return (
    <div className="html-preview">
      <div className="visualization-unavailable">
        Visualization unavailable
      </div>
    </div>
  );
}
```

#### 2. Add Missing Visualization Styles
**File**: `src/client/components/HtmlPreview.css`
**Changes**: Add unavailable state styles

Add to the end of the file:

```css
.visualization-unavailable {
  padding: 24px;
  text-align: center;
  color: #888;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 0.9rem;
  border: 1px dashed #ddd;
}
```

#### 3. Update ChatMessage for Visualization ID
**File**: `src/client/components/ChatMessage.tsx`
**Changes**: Handle missing visualization case

Update the interface and rendering:

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import HtmlPreview from './HtmlPreview';
import './ChatMessage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  visualizationId?: string;  // Add this
  visualizationMissing?: boolean;  // Add this
  isStreaming?: boolean;
  status?: string;
}

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? 'You' : 'AI'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {isAssistant ? (
            <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.isStreaming && !message.status && <span className="cursor">|</span>}
            </div>
          ) : (
            <>
              {message.content}
              {message.isStreaming && !message.status && <span className="cursor">|</span>}
            </>
          )}
        </div>
        {message.status && (
          <div className="message-status">
            <span className="status-spinner"></span>
            {message.status}
          </div>
        )}
        {/* Show visualization or unavailable message */}
        {(message.htmlUI || message.visualizationMissing) && (
          <div className="message-ui">
            <HtmlPreview html={message.htmlUI || ''} />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 4. Update App.tsx with Full Integration
**File**: `src/client/App.tsx`
**Changes**: Complete rewrite with sidebar integration and chat loading

```tsx
import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import ChatSidebar from './components/ChatSidebar';
import SelectionPopup from './components/SelectionPopup';
import BranchChat from './components/BranchChat';

interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  visualizationId?: string;
  visualizationMissing?: boolean;
  isStreaming?: boolean;
  status?: string;
}

interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error' | 'status';
  data: string;
}

export default function App() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [branchChat, setBranchChat] = useState<{ open: boolean; selectedText: string }>({
    open: false,
    selectedText: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat list on mount
  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const response = await fetch('/api/chats');
      const data = await response.json();
      setChats(data.chats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (!response.ok) {
        throw new Error('Chat not found');
      }
      const data = await response.json();

      // Map messages, marking missing visualizations
      const loadedMessages: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        htmlUI: m.htmlUI,
        visualizationId: m.visualizationId,
        // If there's a visualizationId but no htmlUI, it's missing
        visualizationMissing: m.visualizationId && !m.htmlUI,
      }));

      setMessages(loadedMessages);
      setActiveChatId(chatId);
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  };

  const handleSelectChat = (chatId: string) => {
    // Fully reload the selected chat
    loadChat(chatId);
  };

  const handleNewChat = async () => {
    try {
      const response = await fetch('/api/chats', { method: 'POST' });
      const newChat = await response.json();
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleAskQuestion = (selectedText: string) => {
    setBranchChat({ open: true, selectedText });
  };

  const closeBranchChat = () => {
    setBranchChat({ open: false, selectedText: '' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Create chat if none active
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const response = await fetch('/api/chats', { method: 'POST' });
        const newChat = await response.json();
        chatId = newChat.id;
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(chatId);
      } catch (error) {
        console.error('Failed to create chat:', error);
        return;
      }
    }

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
        body: JSON.stringify({ message: content, chatId }),
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
              } else if (chunk.type === 'status') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, status: chunk.data } : m
                  )
                );
              } else if (chunk.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false, status: undefined } : m
                  )
                );
                // Reload chat list to update title/timestamp
                loadChats();
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

  const clearChat = async () => {
    if (activeChatId) {
      await fetch(`/api/chats/${activeChatId}`, { method: 'DELETE' });
      setChats((prev) => prev.filter((c) => c.id !== activeChatId));
    }
    setMessages([]);
    setActiveChatId(null);
  };

  return (
    <div className="app-container">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />
      <div className="app">
        <header className="header">
          <h1>Learning Chat</h1>
          <button onClick={clearChat} className="clear-btn">
            {activeChatId ? 'Delete Chat' : 'Clear Chat'}
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

        <SelectionPopup onAskQuestion={handleAskQuestion} />

        {branchChat.open && (
          <BranchChat
            selectedText={branchChat.selectedText}
            onClose={closeBranchChat}
          />
        )}
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [ ] New Chat button creates a new chat and shows in sidebar
- [ ] Clicking a chat in sidebar fully reloads that conversation
- [ ] Messages appear correctly when loading saved chat
- [ ] Visualizations load and display correctly
- [ ] When a visualization file is manually deleted, "Visualization unavailable" shows
- [ ] Chat title updates after first message
- [ ] Sidebar shows most recent chats at top

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Data Migration & Polish

### Overview
Clean up legacy code, ensure smooth operation, and add final polish.

### Changes Required:

#### 1. Update BranchChat to Use New API
**File**: `src/client/components/BranchChat.tsx`
**Changes**: Update to use chatId parameter (branch chats use temporary IDs)

Find and update the fetch call:

```tsx
// Change this line (around line 79-87):
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: fullMessage,
    chatId: `branch-${Date.now()}`,  // Changed from sessionId
    skipUI: true,
  }),
});
```

#### 2. Remove Legacy Session Code from chat.ts routes
**File**: `src/server/routes/chat.ts`
**Changes**: The legacy endpoints can remain for backwards compatibility but are now properly handled.

No additional changes needed - the endpoints already work with the new chatId-based system.

#### 3. Add Loading State to Sidebar
**File**: `src/client/components/ChatSidebar.tsx`
**Changes**: Add loading prop for initial load state

```tsx
import React from 'react';
import './ChatSidebar.css';

interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface Props {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  isLoading?: boolean;  // Add this
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function ChatSidebar({ chats, activeChatId, onSelectChat, onNewChat, isLoading }: Props) {
  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>
      <div className="chat-list">
        {isLoading ? (
          <div className="no-chats">Loading...</div>
        ) : chats.length === 0 ? (
          <div className="no-chats">No chats yet</div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <span className="chat-title">{chat.title}</span>
              <span className="chat-date">{formatDate(chat.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
```

#### 4. Update App.tsx to Track Loading State
**File**: `src/client/App.tsx`
**Changes**: Add chatsLoading state

Add state variable:
```tsx
const [chatsLoading, setChatsLoading] = useState(true);
```

Update loadChats function:
```tsx
const loadChats = async () => {
  setChatsLoading(true);
  try {
    const response = await fetch('/api/chats');
    const data = await response.json();
    setChats(data.chats);
  } catch (error) {
    console.error('Failed to load chats:', error);
  } finally {
    setChatsLoading(false);
  }
};
```

Update ChatSidebar usage:
```tsx
<ChatSidebar
  chats={chats}
  activeChatId={activeChatId}
  onSelectChat={handleSelectChat}
  onNewChat={handleNewChat}
  isLoading={chatsLoading}
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Application starts: `npm run dev`

#### Manual Verification:
- [ ] Full end-to-end flow works: create chat, send messages, see visualization, switch chats, refresh page - data persists
- [ ] Branch chat (text selection) still works functionally
- [ ] **Branch chats are NOT saved**: After using branch chat, verify no `branch-*` entries in database and no branch chat appears in sidebar
- [ ] "Loading..." shows briefly when opening app
- [ ] No console errors during normal operation
- [ ] Delete a visualization file manually → shows "Visualization unavailable" in chat

**Implementation Note**: This is the final phase. After all verification passes, the implementation is complete.

---

## Testing Strategy

### Unit Tests:
- Database service functions (CRUD operations)
- Visualization file operations (save/load/delete)
- Chat title generation from first message

### Integration Tests:
- Full chat flow: create → message → visualization → persist → reload
- Missing visualization handling
- Multiple concurrent chats

### Manual Testing Steps:
1. Start fresh (delete ./data directory)
2. Open app → should see empty sidebar
3. Click "New Chat" → should create chat
4. Send message → should see response stream
5. If visualization generated → should see it render
6. Click "New Chat" again → should create second chat
7. Click first chat → should fully reload messages
8. Refresh page → all chats should persist
9. Restart server → all chats should persist
10. Manually delete a visualization file → should show "unavailable"
11. **Test branch chat NOT saved**: Select text, open branch chat, send message, close branch chat, check database → no branch chat entries should exist

## Performance Considerations

- SQLite with WAL mode for concurrent reads
- Visualization files kept separate from DB to avoid blob storage
- Chat list loaded once on mount, refreshed after new messages
- Messages loaded on-demand when selecting chat (not all upfront)

## Migration Notes

- No migration needed (fresh SQLite database)
- Old in-memory sessions are discarded (expected behavior)
- Branch chats continue to be temporary (not persisted)

## References

- SQLite WAL mode: https://sqlite.org/wal.html
- better-sqlite3 docs: https://github.com/WiseLibs/better-sqlite3
- Current chat implementation: `src/services/chat.ts:15-100`
- Current visualization pipeline: `src/services/ui-evaluator.ts`, `src/services/html-generator.ts`
