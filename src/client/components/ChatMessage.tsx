import React from 'react';
import HtmlPreview from './HtmlPreview';
import './ChatMessage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlUI?: string;
  isStreaming?: boolean;
  status?: string;
}

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'user' ? 'You' : 'AI'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {message.content}
          {message.isStreaming && !message.status && <span className="cursor">|</span>}
        </div>
        {message.status && (
          <div className="message-status">
            <span className="status-spinner"></span>
            {message.status}
          </div>
        )}
        {message.htmlUI && (
          <div className="message-ui">
            <HtmlPreview html={message.htmlUI} />
          </div>
        )}
      </div>
    </div>
  );
}
