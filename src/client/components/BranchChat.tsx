import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './BranchChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'context';
  content: string;
  isStreaming?: boolean;
  status?: string;
}

interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error' | 'status';
  data: string;
}

interface Props {
  selectedText: string;
  onClose: () => void;
}

export default function BranchChat({ selectedText, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'context',
      role: 'context',
      content: selectedText,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput('');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    // Build the full message with context
    const fullMessage = `The user has highlighted the following text and wants to ask a question about it:

--- HIGHLIGHTED TEXT ---
${selectedText}
--- END HIGHLIGHTED TEXT ---

User's question: ${userContent}

Please answer their question specifically about the highlighted text.`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullMessage,
          sessionId: `branch-${Date.now()}`, // Separate session for branch
          skipUI: true, // No visualizations in branch chat
        }),
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
              } else if (chunk.type === 'status') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, status: chunk.data } : m
                  )
                );
              } else if (chunk.type === 'done') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, isStreaming: false, status: undefined }
                      : m
                  )
                );
              } else if (chunk.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Error: ${chunk.data}`, isStreaming: false }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="branch-chat-overlay" onClick={onClose}>
      <div className="branch-chat" onClick={(e) => e.stopPropagation()}>
        <div className="branch-chat-header">
          <h3>Ask about selection</h3>
          <button className="close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="branch-chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`branch-message ${message.role}`}>
              {message.role === 'context' ? (
                <>
                  <div className="context-label">Selected text:</div>
                  <div className="context-text">"{message.content}"</div>
                </>
              ) : (
                <>
                  <div className="message-role">
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className="message-content">
                    {message.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                        {message.isStreaming && !message.status && (
                          <span className="cursor">|</span>
                        )}
                      </div>
                    ) : (
                      <>
                        {message.content}
                        {message.isStreaming && !message.status && (
                          <span className="cursor">|</span>
                        )}
                      </>
                    )}
                  </div>
                  {message.status && (
                    <div className="message-status">
                      <span className="status-spinner"></span>
                      {message.status}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="branch-chat-input">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the selected text..."
            disabled={isLoading}
            rows={1}
          />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
