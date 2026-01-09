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

    // Evaluate if UI would help (skip for branch chats)
    if (!options.skipUI) {
      onChunk({ type: 'status', data: 'Analyzing response...' });
      const evaluation = await evaluateForUI(assistantContent);

      if (evaluation.shouldGenerateUI) {
        try {
          onChunk({ type: 'status', data: 'Creating interactive visualization...' });
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
      onChunk({ type: 'status', data: '' }); // Clear status
    }

    // Signal completion
    onChunk({ type: 'done', data: '' });

    this.messages.push(assistantMessage);
    return assistantMessage;
  }
}

export function createChatService(): ChatService {
  return new ChatService();
}
