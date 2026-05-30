import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';


export function ChatWindow({
  room
}) {
  const {
    messages,
    typingUsers
  } = useChatStore();
  const user = useAuthStore(state => state.user);
  const roomMessages = messages[room.id] || [];
  const roomTypingUsers = typingUsers[room.id] || [];

  // Filter out current user from typing users
  const othersTyping = roomTypingUsers.filter(t => t.userId !== user?.id);

  return (
    <div className="flex-1 flex flex-col h-screen bg-pattern-1 text-[var(--color-text)]">
      <ChatHeader room={room} />

      <div className="flex-1 flex flex-col overflow-hidden border-t border-[var(--color-border)]">
        <MessageList messages={roomMessages} room={room} />

        {othersTyping.length > 0 && <TypingIndicator users={othersTyping} />}
      </div>

      <MessageInput roomId={room.id} />
    </div>
  );
}