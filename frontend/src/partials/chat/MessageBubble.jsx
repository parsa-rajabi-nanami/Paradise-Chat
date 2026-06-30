import { CheckCheck, Edit2, Trash2, Paperclip } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import clsx from 'clsx';
import { format } from 'date-fns';
import { memo } from 'react';


function MessageBubble({
    room_id,
    message,
    isOwn,
    showAvatar,
    updateMessage,
    deleteMessage
}) {
    const time = format(new Date(message.created_at), 'HH:mm');
    const getFileName = (url) => {
        try {
            return url.split('/').pop();
        } catch {
            return "file";
        }
    };

    const handleUpdateMessage = () => {
        const newContent = prompt("Edit your message:", message.content);
        if (newContent && newContent !== message.content) {
            updateMessage(room_id, message.id, newContent);
        }
    };

    return (
        <div className={clsx('flex items-end space-x-2', isOwn ? 'flex-row-reverse space-x-reverse' : '')}>
            {/* Avatar */}
            <div className="w-8 flex-shrink-0">
                {showAvatar && message.sender && <Avatar name={message.sender.display_name || message.sender.username} src={message.sender.avatar} size="sm" />}
            </div>

            {/* Message */}
            <div className={clsx('group max-w-[80%]', isOwn ? 'items-end' : 'items-start')}>
                {/* Sender name for others */}
                {showAvatar && !isOwn && message.sender && <p className="text-xs text-[var(--color-text-muted)] mb-1 ml-1">
                    {message.sender.display_name || message.sender.username}
                </p>}

                {message.is_deleted ? <div className={clsx('relative p-4 rounded-md italic text-sm', isOwn ? 'bg-[var(--color-primary)] text-white rounded-br-none' : 'bg-[var(--color-surface)] text-[var(--color-text)] rounded-bl-none')}>
                    This message has been deleted
                </div> : <>
                    <div className={clsx('relative p-4 rounded-md', isOwn ? 'bg-[var(--color-primary)] text-white rounded-br-none' : 'bg-[var(--color-surface)] text-[var(--color-text)] rounded-bl-none')}>
                        {/* Reply preview */}
                        {/* TODO: Check */}
                        {message.reply_to_preview && <div className={clsx('mb-2 p-2 rounded-lg text-xs border-l-2', isOwn ? 'bg-primary-700 border-primary-400' : 'bg-gray-600 border-gray-400')}>
                            <p className="font-medium">{message.reply_to_preview.sender}</p>
                            <p className="truncate opacity-75">{message.reply_to_preview.content}</p>
                        </div>}

                        {/* Attachment */}
                        {message.attachment && (
                            <div className="mb-2">
                                {message.message_type === "image" ? (
                                    <a href={message.attachment} target="_blank" rel="noreferrer">
                                        <img
                                            src={message.attachment}
                                            alt={getFileName(message.attachment)}
                                            className="max-w-[300px] w-full rounded-md"
                                        />
                                    </a>
                                ) : (
                                    <a
                                        href={message.attachment}
                                        download
                                        rel="noreferrer"
                                        className={clsx(
                                            "flex items-center gap-2 rounded-md px-3 py-2 border text-sm border-[var(--color-secondary)]",
                                            isOwn ? "text-white" : "text-[var(--color-text)]"
                                        )}
                                    >
                                        <Paperclip className="w-4 h-4 text-[var(--color-secondary)]" />
                                        <span className="truncate">{getFileName(message.attachment)}</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>

                        {/* Footer */}
                        <div className={clsx('flex items-center mt-1 space-x-1 text-xs', isOwn ? 'text-[var(--color-secondary-text)]' : 'text-[var(--color-text-muted)]')}>
                            <span>{time}</span>
                            {message.is_edited && <span className="italic">(edited)</span>}
                            {isOwn && <CheckCheck className="w-4 h-4" />}
                        </div>
                    </div>

                    {/* Actions */}
                    {/* TODO: Check Mobile hover And Better Ui */}
                    {isOwn && <div className="hidden group-hover:flex mt-1 space-x-1 justify-end">
                        <button
                            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                            onClick={() => handleUpdateMessage()}
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-danger)]"
                            onClick={() => deleteMessage(room_id, message.id)}
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>}
                </>}
            </div>
        </div>
    );
}

export default memo(MessageBubble);