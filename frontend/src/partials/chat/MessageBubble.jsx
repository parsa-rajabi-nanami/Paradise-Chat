import { useState, memo, useCallback } from 'react';
import { CheckCheck, Check, Edit2, Trash2, Paperclip, X, Check as SaveIcon } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import clsx from 'clsx';
import { format, isValid } from 'date-fns';

function MessageBubble({
  room_id,
  message,
  isOwn,
  showAvatar,
  updateMessage,
  deleteMessage,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

  // Safe date formatting
  const formattedTime = useCallback(() => {
    if (!message?.created_at) return '';
    const date = new Date(message.created_at);
    return isValid(date) ? format(date, 'HH:mm') : '';
  }, [message?.created_at])();

  // Robust filename extraction handling query parameters
  const getFileName = (url) => {
    try {
      const pathname = new URL(url).pathname;
      const fileName = pathname.split('/').pop();
      return fileName ? decodeURIComponent(fileName) : 'attachment';
    } catch {
      return 'attachment';
    }
  };

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content) {
      updateMessage(room_id, message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message for everyone?')) {
      deleteMessage(room_id, message.id);
    }
  };

  const senderName = message?.sender?.display_name || message?.sender?.username || 'User';

  return (
    <div className={clsx('flex items-end space-x-2 my-1.5', isOwn && 'flex-row-reverse space-x-reverse')}>
      {/* Sender Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && message?.sender && (
          <Avatar name={senderName} src={message.sender.avatar} size="sm" />
        )}
      </div>

      {/* Message Bubble Container */}
      <div className={clsx('group relative max-w-[85%] sm:max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender Name (Groups) */}
        {showAvatar && !isOwn && (
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1 ml-1 truncate">
            {senderName}
          </p>
        )}

        {/* Deleted State */}
        {message?.is_deleted ? (
          <div
            className={clsx(
              'px-4 py-2.5 rounded-2xl text-sm italic border',
              isOwn
                ? 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] rounded-br-none'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] rounded-bl-none'
            )}
          >
            This message was deleted
          </div>
        ) : (
          <div
            className={clsx(
              'relative p-3.5 rounded-2xl shadow-sm text-sm transition-all',
              isOwn
                ? 'bg-[var(--color-primary)] text-white rounded-br-none'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-none'
            )}
          >
            {/* Reply Preview */}
            {message?.reply_to_preview && (
              <div
                className={clsx(
                  'mb-2 p-2 rounded-lg text-xs border-l-2 bg-black/10',
                  isOwn ? 'border-white/60 text-white/90' : 'border-[var(--color-primary)] text-[var(--color-text-muted)]'
                )}
              >
                <p className="font-semibold">{message.reply_to_preview.sender}</p>
                <p className="truncate opacity-80">{message.reply_to_preview.content}</p>
              </div>
            )}

            {/* Media & Attachment */}
            {message?.attachment && (
              <div className="mb-2">
                {message.message_type === 'image' ? (
                  <a href={message.attachment} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                    <img
                      src={message.attachment}
                      alt={getFileName(message.attachment)}
                      loading="lazy"
                      className="max-w-full max-h-72 object-cover rounded-lg hover:opacity-95 transition-opacity"
                    />
                  </a>
                ) : (
                  <a
                    href={message.attachment}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      'flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-medium transition-colors',
                      isOwn
                        ? 'border-white/20 bg-white/10 hover:bg-white/20 text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                    )}
                  >
                    <Paperclip className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[180px]">{getFileName(message.attachment)}</span>
                  </a>
                )}
              </div>
            )}

            {/* Content or Inline Editor */}
            {isEditing ? (
              <div className="space-y-2 min-w-[200px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  rows={2}
                  className="w-full text-sm p-2 rounded-lg bg-black/10 border border-white/30 text-inherit focus:outline-none focus:ring-1 focus:ring-white resize-none"
                />
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }}
                    className="p-1 rounded hover:bg-black/20 text-xs flex items-center gap-1"
                    title="Cancel (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 rounded hover:bg-black/20 text-xs flex items-center gap-1 font-medium"
                    title="Save (Enter)"
                  >
                    <SaveIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}

            {/* Bubble Footer / Metadata */}
            <div
              className={clsx(
                'flex items-center justify-end gap-1 mt-1 text-[10px] select-none',
                isOwn ? 'text-white/70' : 'text-[var(--color-text-muted)]'
              )}
            >
              <span>{formattedTime}</span>
              {message?.is_edited && <span className="italic">(edited)</span>}
              {isOwn && (
                message?.is_read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )
              )}
            </div>
          </div>
        )}

        {/* Hover / Mobile Touch Quick Actions */}
        {isOwn && !message?.is_deleted && !isEditing && (
          <div
            className={clsx(
              'absolute top-0 -translate-y-1/2 flex items-center gap-0.5 p-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-md transition-opacity duration-150',
              'opacity-100 md:opacity-0 md:group-hover:opacity-100',
              isOwn ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full -mr-2'
            )}
          >
            <button
              onClick={() => setIsEditing(true)}
              aria-label="Edit message"
              className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              aria-label="Delete message"
              className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);