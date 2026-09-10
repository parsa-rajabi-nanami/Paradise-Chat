import { useState, useRef, useEffect, useCallback } from 'react';
import { wsService } from '../../services/websocket';
import { Send, Paperclip, X, FileText } from 'lucide-react';
import clsx from 'clsx';

export function MessageInput({ roomId, replyTo, onCancelReply }) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (message) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
      }
    }
  }, [message]);

  // Auto-focus input when replying
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  // Handle image file object URL preview & cleanup
  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setFilePreview(null);
    }
  }, [file]);

  // Debounced typing indicator logic
  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      wsService.sendTyping(false);
    }
  }, []);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsService.sendTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  }, [stopTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = message.trim();

    if (!trimmed && !file) return;

    wsService.sendMessage({
      room: roomId,
      content: trimmed,
      file,
      replyTo: replyTo?.id,
    });

    // Reset input state
    setMessage('');
    handleRemoveFile();
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    onCancelReply?.();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-2 md:p-3 relative">
      {/* Reply Preview Bar */}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-lg border-l-4 border-[var(--color-primary)] shadow-sm">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-semibold text-[var(--color-primary)]">
              Replying to {replyTo.sender}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              {replyTo.content}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Preview Card */}
      {file && (
        <div className="mb-2 flex items-center gap-3 bg-[var(--color-bg)] p-2 rounded-lg border border-[var(--color-border)] max-w-xs relative group">
          {filePreview ? (
            <img
              src={filePreview}
              alt="Attachment preview"
              className="w-12 h-12 object-cover rounded-md border border-[var(--color-border)]"
            />
          ) : (
            <div className="w-12 h-12 rounded-md bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)]">
              <FileText className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-text)] truncate">{file.name}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="p-1 rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] shadow-sm transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Action Form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />

        {/* Action Controls Left */}
        <div className="flex items-center gap-1 pb-1">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea Container */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full text-sm p-2.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] hide-scrollbar leading-relaxed"
            style={{ maxHeight: '150px' }}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() && !file}
          className={clsx(
            'p-2.5 rounded-full transition-all flex items-center justify-center shrink-0 mb-0.5',
            message.trim() || file
              ? 'bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm'
              : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
