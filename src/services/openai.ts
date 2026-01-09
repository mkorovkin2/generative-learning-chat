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
  webSearch?: boolean;
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
