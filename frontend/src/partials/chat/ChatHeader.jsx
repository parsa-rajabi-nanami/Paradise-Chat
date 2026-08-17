import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Users, ArrowLeft } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { ChatDetails } from './ChatDetails';
import { useAuthStore } from '../../stores/authStore';

export function ChatHeader({ room }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const participants = room?.participants_info || [];
  const isDirect = room?.room_type === 'direct';

  const otherParticipant = isDirect
    ? participants.find((p) => p.user?.id !== user?.id)?.user
    : null;

  const isOnline = otherParticipant?.is_online;
  const participantCount = participants.length;

  const handleOpenDetails = () => setIsDetailsOpen(true);
  const handleCloseDetails = () => setIsDetailsOpen(false);

  return (
    <>
      <header className="h-16 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] select-none">
        {/* Clickable Header Info Area */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpenDetails}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenDetails();
            }
          }}
          className="flex items-center space-x-3 cursor-pointer min-w-0 py-1 px-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          {/* Back button (Mobile view) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/chat');
            }}
            aria-label="Back to chat list"
            className="md:hidden p-1.5 -ml-1 rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar
            name={room?.display_name}
            src={room?.display_avatar}
            size="md"
            isOnline={isDirect ? isOnline : undefined}
          />

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base text-[var(--color-text)] truncate max-w-[160px] sm:max-w-xs md:max-w-md">
              {room?.display_name || 'Chat'}
            </h2>

            <div className="text-xs text-[var(--color-text-muted)] flex items-center">
              {isDirect ? (
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    isOnline ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              ) : (
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {participantCount} {participantCount === 1 ? 'member' : 'members'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleOpenDetails}
            aria-label="View conversation details"
            className="p-2 rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Group / User Details Panel */}
      {isDetailsOpen && (
        <ChatDetails
          room={room}
          onClose={handleCloseDetails}
          currentUser={user}
        />
      )}
    </>
  );
}