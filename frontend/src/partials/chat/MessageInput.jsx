import { useState, useRef, useEffect, useCallback } from 'react';
import { wsService } from '../../services/websocket';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import clsx from 'clsx';


// TODO: add feature send stickers
export function MessageInput({
  roomId,
  replyTo,
  onCancelReply
}) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [file, setFile] = useState(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      wsService.sendTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      wsService.sendTyping(false);
    }, 2000);
  }, [isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTyping) wsService.sendTyping(false);
    };
  }, [isTyping]);

  const handleSubmit = e => {
    e?.preventDefault();
    const trimmed = message.trim();

    if (!trimmed && !file) return;

    wsService.sendMessage({
      room: roomId,
      content: trimmed,
      file,
      replyTo: replyTo?.id
    });

    setMessage('');
    setFile(null);

    if (isTyping) {
      setIsTyping(false);
      wsService.sendTyping(false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    onCancelReply?.();
    textareaRef.current?.focus();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-2 md:p-3">

      {/* Reply box */}
      {/* TODO: Check */}
      {replyTo && (
        <div className="mb-3 flex items-center justify-between px-3 py-2 bg-[var(--color-surface)] rounded border border-[var(--color-border)] shadow-soft">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--color-text)]">
              Replying to {replyTo.sender}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] truncate">
              {replyTo.content}
            </p>
          </div>

          <button
            onClick={onCancelReply}
            className="p-1 rounded btn-input-msg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 md:gap-3 justify-end md:justify-start">

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className={clsx(
            'btn-input-msg mr-auto',
            message.trim() && 'bg-[var(--color-primary)] text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary)]'
          )}
        >
          <Send className="w-5 h-5" />
        </button>

        {/* Attachment */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={e => setFile(e.target.files[0])}
        />
        <button
          type="button"
          className="btn-input-msg"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Emoji */}
        <button type="button" className="btn-input-msg">
          <Smile className="w-5 h-5" />
        </button>

        {/* Main input area */}
        <div className="flex-1 basis-full md:basis-auto">

          {/* File preview */}
          {file && (
            <div className="mb-2 flex items-center justify-between bg-[var(--color-surface)] px-3 py-2 rounded border border-[var(--color-border)] shadow-soft">
              <span className="text-sm text-[var(--color-text)]">
                {file.name}
              </span>
              <button onClick={() => setFile(null)} className="btn-input-msg p-1">
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="input flex items-center rounded p-3 w-full resize-none hide-scrollbar"
            style={{ maxHeight: '150px' }}
          />
        </div>
      </form>
    </div>
  );
}
