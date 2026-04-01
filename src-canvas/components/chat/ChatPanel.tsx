import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { ChatMessage, CanvasCard } from '../../lib/canvasTypes';

const ALLOWED_TAGS = ['strong', 'em', 'br', 'code'];
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isAgentThinking: boolean;
  selectedCard: CanvasCard | null;
  onSendMessage: (text: string) => void;
  onDeselectCard: () => void;
}

export function ChatPanel({
  messages,
  isAgentThinking,
  selectedCard,
  onSendMessage,
  onDeselectCard,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentThinking]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Context chip for selected card
  const contextLabel = selectedCard
    ? `${selectedCard.cardType.charAt(0).toUpperCase() + selectedCard.cardType.slice(1)}: ${selectedCard.label}`
    : '';

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-icon">AI</div>
        <div className="chat-header-text">
          <div className="chat-header-title">Campaign Strategist</div>
          <div className="chat-header-context">
            {selectedCard ? contextLabel : 'Ready to build your campaign'}
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isAgentThinking && (
          <div className="msg agent">
            <div className="msg-avatar">AI</div>
            <div className="msg-bubble">
              Hi! I'm your campaign strategist. Describe your campaign goals and I'll help you build
              a visual strategy on the canvas.
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'tool') {
            return (
              <div key={msg.id} className="tool-msg">
                <div className="tool-pill">{msg.toolLabel || 'Processing'}</div>
                {msg.toolResult && (
                  <div
                    className="tool-result"
                    dangerouslySetInnerHTML={{ __html: sanitize(msg.toolResult) }}
                  />
                )}
              </div>
            );
          }

          return (
            <div key={msg.id} className={`msg ${msg.role}`}>
              <div className="msg-avatar">{msg.role === 'agent' ? 'AI' : 'You'}</div>
              <div
                className="msg-bubble"
                dangerouslySetInnerHTML={{ __html: sanitize(msg.text) }}
              />
            </div>
          );
        })}

        {isAgentThinking && (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {selectedCard && (
          <div className="chat-input-context has-context">
            <div className="chat-input-context-card">
              <div className="chat-input-context-header">
                <span className="ctx-type">{selectedCard.cardType}</span>
                <span className="ctx-label">{selectedCard.label}</span>
                <button className="ctx-close" onClick={onDeselectCard} title="Remove context">
                  &times;
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input-field"
            placeholder="Describe your campaign goals..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={handleSubmit}
            disabled={!input.trim() || isAgentThinking}
            title="Send message"
          >
            &#8593;
          </button>
        </div>
      </div>
    </div>
  );
}
