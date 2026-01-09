import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SelectionPopup from './components/SelectionPopup';
import BranchChat from './components/BranchChat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  isStreaming?: boolean;
  status?: string;
}

interface StreamChunk {
  type: 'content' | 'ui' | 'done' | 'error' | 'status';
  data: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [branchChat, setBranchChat] = useState<{ open: boolean; selectedText: string }>({
    open: false,
    selectedText: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      <SelectionPopup onAskQuestion={handleAskQuestion} />

      {branchChat.open && (
        <BranchChat
          selectedText={branchChat.selectedText}
          onClose={closeBranchChat}
        />
      )}
    </div>
  );
}
