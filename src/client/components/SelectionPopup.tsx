import React, { useEffect, useState } from 'react';
import './SelectionPopup.css';

interface Props {
  onAskQuestion: (selectedText: string, rect: DOMRect) => void;
}

export default function SelectionPopup({ onAskQuestion }: Props) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      if (text.length > 0) {
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          // Position the popup above the selection, centered
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          });
          setSelectedText(text);
          setSelectionRect(rect);
        }
      } else {
        setPosition(null);
        setSelectedText('');
        setSelectionRect(null);
      }
    };

    // Use mouseup to detect when selection is complete
    const handleMouseUp = () => {
      // Small delay to let selection finalize
      setTimeout(handleSelectionChange, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText && selectionRect) {
      onAskQuestion(selectedText, selectionRect);
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setPosition(null);
      setSelectedText('');
    }
  };

  if (!position || !selectedText) return null;

  return (
    <button
      className="selection-popup"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={handleClick}
      title="Ask about this"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  );
}
