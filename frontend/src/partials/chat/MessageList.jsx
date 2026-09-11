import { useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isValid } from 'date-fns';
import { Pin, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import MessageBubble from './MessageBubble';

export function MessageList({
  messages = [],
  room,
  onReply,
  onPin
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Atomic selectors to prevent unnecessary re-renders
  const user = useAuthStore((state) => state.user);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);

  // Reset initial mount flag before the message effect runs for a new room.
  useEffect(() => {
    isInitialMount.current = true;
  }, [room?.id]);

  // Smart auto-scroll logic
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    // Check if user is scrolled within 150px of the bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isInitialMount.current) {
      scrollToBottom('auto');
      isInitialMount.current = false;
    } else if (isNearBottom) {
      scrollToBottom('smooth');
    }
  }, [messages, room?.id, scrollToBottom]);

  // Safe date formatting helper
  const formatMessageDate = (date) => {
    if (!date || !isValid(date)) return 'Unknown Date';
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date using reduce
  const groupedMessages = messages.reduce((acc, message) => {
    const messageDate = new Date(message.created_at);
    const dateString = formatMessageDate(messageDate);

    let lastGroup = acc[acc.length - 1];
    if (!lastGroup || lastGroup.date !== dateString) {
      lastGroup = { date: dateString, messages: [] };
      acc.push(lastGroup);
    }
    lastGroup.messages.push(message);
    return acc;
  }, []);

  const pinnedMessage = room?.pinned_message;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-[var(--color-bg)]">
      {/* Sticky Pinned Message Banner */}
      {pinnedMessage && (
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[var(--color-surface)]/95 backdrop-blur border-b border-[var(--color-border)] shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <div className="text-xs min-w-0">
              <p className="font-semibold text-[var(--color-primary)] truncate">
                Pinned Message
              </p>
              <p className="text-[var(--color-text-muted)] truncate">
                {pinnedMessage.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-2 opacity-70">
            <MessageSquare className="w-10 h-10 stroke-1" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                  {group.date}
                </div>
              </div>

              {/* Messages List */}
              <div className="space-y-2">
                {group.messages.map((message, index) => {
                  const isOwn = message.sender?.id === user?.id;
                  const prevSenderId = group.messages[index - 1]?.sender?.id;
                  const showAvatar = index === 0 || prevSenderId !== message.sender?.id;

                  return (
                    <MessageBubble
                      key={message.id}
                      room_id={room?.id}
                      message={message}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      updateMessage={updateMessage}
                      deleteMessage={deleteMessage}
                      onReply={onReply}
                      onPin={onPin}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
