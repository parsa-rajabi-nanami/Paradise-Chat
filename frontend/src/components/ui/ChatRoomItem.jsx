import { formatDistanceToNow } from 'date-fns';
import { Avatar } from './Avatar';

export function ChatRoomItem({
    room,
    isActive,
    onClick
}) {
    const otherParticipant = room.participants_info.find(p => p.user.username !== room.display_name)?.user;

    return (
        <button onClick={onClick}
            style={{
                paddingLeft: `${16 + room.depth * 20}px`,
                background: isActive ? 'var(--color-bg)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent'
            }}
            className="w-full p-4 flex items-center space-x-3 transition-all text-left hover:!bg-[var(--color-secondary-text)] dark:hover:!bg-[var(--color-bg)] border-[var(--color-border)]">

            <Avatar name={room.display_name} src={room.display_avatar} size="lg" isOnline={room.room_type === 'direct' ? otherParticipant?.is_online : undefined} />

            <div className="flex-1 min-w-0">

                <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate text-[var(--color-text)]">{room.display_name}</span>
                    {room.last_message && <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDistanceToNow(new Date(room.last_message.created_at), {
                            addSuffix: false
                        })}
                    </span>}
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-sm truncate text-[var(--color-text-muted)]">
                        {room.last_message?.content || 'No messages yet'}
                    </p>
                    {room.unread_count > 0 && <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-accent)] text-[var(--color-bg)]">
                        {room.unread_count > 99 ? '99+' : room.unread_count}
                    </span>}
                </div>

            </div>

        </button>
    );
}