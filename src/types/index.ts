export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
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
