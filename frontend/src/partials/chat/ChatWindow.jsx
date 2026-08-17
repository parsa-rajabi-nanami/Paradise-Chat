import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';

export function ChatWindow({ room }) {
  const roomId = room?.id;

  // Granular store selectors prevent unnecessary re-renders from other rooms
  const roomMessages = useChatStore((state) => (roomId ? state.messages[roomId] || [] : []));
  const roomTypingUsers = useChatStore((state) => (roomId ? state.typingUsers[roomId] || [] : []));
  const currentUser = useAuthStore((state) => state.user);

  // Memoize filtering to avoid extra renders when current user state updates
  const othersTyping = useMemo(
    () => roomTypingUsers.filter((t) => t.userId !== currentUser?.id),
    [roomTypingUsers, currentUser?.id]
  );

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-[var(--color-text-muted)] bg-[var(--color-surface)]">
        <p className="text-sm font-medium">Select a conversation to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-pattern-1 text-[var(--color-text)] relative">
      <ChatHeader room={room} />

      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden border-t border-[var(--color-border)]">
        <MessageList messages={roomMessages} room={room} />

        {othersTyping.length > 0 && (
          <div className="px-4 py-1.5 bg-[var(--color-surface)]/90 backdrop-blur-sm border-t border-[var(--color-border)] transition-all">
            <TypingIndicator users={othersTyping} />
          </div>
        )}
      </main>

      <MessageInput roomId={roomId} />
    </div>
  );
}