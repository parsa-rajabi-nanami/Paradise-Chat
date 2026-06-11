import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { ChatDetails } from './ChatDetails';
import { useAuthStore } from "../../stores/authStore";
import { MoreVertical, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


export function ChatHeader({
  room
}) {
  const navigate = useNavigate();

  const {
    user,
  } = useAuthStore();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const otherParticipant = room.room_type === 'direct' ? room.participants_info.find(p => p.user.id !== user?.id)?.user : null;
  const isOnline = otherParticipant?.is_online;
  const participantCount = room.participants_info?.length || 0;

  const handleOpenDetails = () => {
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
  };

  return (
    <>
      <div className="h-16 px-4 flex items-center justify-between bg-[var(--color-surface)] text-[var(--color-text)]">
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails();
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/chat');
            }}
            className="md:hidden p-2 -ml-2 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar name={room.display_name} src={room.display_avatar} size="md" isOnline={room.room_type === 'direct' ? isOnline : undefined} />

          <div>
            <h2 className="font-semibold text-[var(--color-text)]">{room.display_name}</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {room.room_type === 'direct' ? isOnline ? 'Online' : 'Offline' : <span className="flex items-center">
                <Users className="w-3 h-3 mr-1" />
                {participantCount} members
              </span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isDetailsOpen && (
        <ChatDetails room={room} onClose={handleCloseDetails} currentUser={user} />
      )}
    </>
  );
}