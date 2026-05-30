import { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { MessageBubble } from './MessageBubble';


// TODO: add pin message feature
// TODO: add replay feature
export function MessageList({
  messages,
  room
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const user = useAuthStore(state => state.user);
  const { updateMessage, deleteMessage } = useChatStore(state => ({
    updateMessage: state.updateMessage,
    deleteMessage: state.deleteMessage
  }));

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  const formatMessageDate = date => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date
  const groupedMessages = [];
  let currentGroup = null;
  messages.forEach(message => {
    const messageDate = new Date(message.created_at);
    const dateString = formatMessageDate(messageDate);
    if (!currentGroup || currentGroup.date !== dateString) {
      currentGroup = {
        date: dateString,
        messages: []
      };
      groupedMessages.push(currentGroup);
    }
    currentGroup.messages.push(message);
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4">
      {groupedMessages.map((group, groupIndex) => <div key={groupIndex}>
        {/* Date Separator */}
        <div className="flex items-center justify-center my-4">
          <div className="px-3 py-1 rounded-full text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)]">
            {group.date}
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-2">
          {group.messages.map((message, index) => {
            const isOwn = message.sender?.id === user?.id;
            const showAvatar = index === 0 || group.messages[index - 1]?.sender?.id !== message.sender?.id;
            return <MessageBubble
              key={message.id}
              room_id={room.id}
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              updateMessage={updateMessage}
              deleteMessage={deleteMessage}
            />;
          })}
        </div>
      </div>)}
      <div ref={messagesEndRef} />
    </div>
  );
}