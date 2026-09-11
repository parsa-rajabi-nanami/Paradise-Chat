import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import { wsService } from '../services/websocket';
import { Sidebar } from '../partials/chat/Sidebar';
import { ChatWindow } from '../partials/chat/ChatWindow';
import { EmptyState } from '../partials/chat/EmptyState';

export function ChatPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const {
    activeRoom,
    setActiveRoom,
    fetchRooms,
    rooms,
    fetchMessages,
    isLoading
  } = useChatStore();

  useEffect(() => {
    fetchRooms();
    wsService.connectToStatus();

    return () => {
      wsService.disconnectFromStatus();
    };
  }, [fetchRooms]);

  useEffect(() => {
    if (!roomId) {
      wsService.disconnectFromRoom();
      return;
    }

    wsService.connectToRoom(roomId);

    return () => {
      wsService.disconnectFromRoom();
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setActiveRoom(null);
      return;
    }

    if (rooms.length > 0) {
      const matchingRoom = rooms.find((r) => String(r.id) === String(roomId));

      if (matchingRoom) {
        if (activeRoom?.id !== matchingRoom.id) {
          setActiveRoom(matchingRoom);
          fetchMessages(matchingRoom.id);
        }
      } else if (!isLoading) {
        setActiveRoom(null);
        navigate('/chat', { replace: true });
      }
    }
  }, [roomId, rooms, activeRoom?.id, isLoading, setActiveRoom, fetchMessages, navigate]);

  const handleRoomSelect = (room) => {
    navigate(`/chat/${room.id}`);
  };

  return (
    <div className="h-[100dvh] min-h-0 flex bg-[var(--bg-primary)] transition-colors duration-300 overflow-hidden w-full">
      <div
        className={`${
          roomId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
        } w-full md:w-80 shrink-0 border-r bg-[var(--color-surface)] border-[var(--color-border)]`}
      >
        <Sidebar onRoomSelect={handleRoomSelect} />
      </div>

      <div
        className={`${
          roomId ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col min-w-0 min-h-0`}
      >
        {activeRoom ? <ChatWindow room={activeRoom} /> : <EmptyState />}
      </div>
    </div>
  );
}
