import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import { wsService } from '../services/websocket';
import { Sidebar } from '../partials/chat/Sidebar';
import { ChatWindow } from '../partials/chat/ChatWindow';
import { EmptyState } from '../partials/chat/EmptyState';


export function ChatPage() {
  const {
    roomId
  } = useParams();
  const navigate = useNavigate();
  const {
    activeRoom,
    setActiveRoom,
    fetchRooms,
    rooms,
    fetchMessages
  } = useChatStore();

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
    wsService.connectToStatus();
    return () => {
      wsService.disconnectFromStatus();
    };
  }, [fetchRooms]);

  // Handle room selection from URL
  useEffect(() => {
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        setActiveRoom(room);
        fetchMessages(roomId);
        wsService.connectToRoom(roomId);
      }
    } else if (!roomId) {
      setActiveRoom(null);
      wsService.disconnectFromRoom();
    }
    return () => {
      if (roomId) {
        wsService.disconnectFromRoom();
      }
    };
  }, [roomId, rooms, setActiveRoom, fetchMessages]);

  const handleRoomSelect = room => {
    navigate(`/chat/${room.id}`);
  };

  return (
    <div className="h-screen flex bg-[var(--bg-primary)] transition-colors duration-300 overflow-hidden w-full">
      {/* Sidebar */}
      <div className={`${roomId ? 'hidden md:flex md:flex-col' : 'flex flex-col'} max-w-full w-full md:w-80 border-r bg-[var(--color-surface)] border-[var(--color-border)]`}>
        <Sidebar onRoomSelect={handleRoomSelect} />
      </div>

      {/* Main Content */}
      <div className={`${roomId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 max-w-full md:max-w-[calc(100%-20rem)]`}>
        {activeRoom ? <ChatWindow room={activeRoom} /> : <EmptyState />}
      </div>
    </div>
  );
}