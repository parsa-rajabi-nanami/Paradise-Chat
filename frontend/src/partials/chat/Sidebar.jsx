import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/ui/Avatar';
import { ChatRoomItem } from '../../components/ui/ChatRoomItem';
import { NewChatModal } from './NewChatModal';
import { MessageSquare, Plus, LogOut, Settings, Search, Users, X, SearchX } from 'lucide-react';
import toast from 'react-hot-toast';

export function Sidebar({ onRoomSelect }) {
  const navigate = useNavigate();

  const { rooms, activeRoom, isLoading } = useChatStore();
  const { user, logout } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filteredRooms = rooms.filter((room) =>
    (room.display_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <aside className="flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded flex items-center justify-center bg-[var(--color-primary)] dark:bg-[var(--color-secondary)]">
              <MessageSquare className="w-5 h-5 text-[var(--color-secondary-text)]" />
            </div>
            <div>
              <h1 className="font-bold text-[var(--color-text)]">Paradise Chat</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Real-time messaging</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-xl transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]"
            title="New Chat"
            aria-label="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm pl-9 pr-8 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 rounded-full animate-spin border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-[var(--color-text-muted)]">
            <Users className="w-8 h-8 mb-2 opacity-60" />
            <p className="text-sm font-medium">No conversations yet</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="mt-2 text-sm text-[var(--color-primary)] hover:underline"
            >
              Start a new chat
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center text-[var(--color-text-muted)]">
            <SearchX className="w-8 h-8 mb-2 opacity-60" />
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs mt-1">Try searching for a different term</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filteredRooms.map((room) => (
              <ChatRoomItem
                key={room.id}
                room={room}
                isActive={activeRoom?.id === room.id}
                onClick={() => onRoomSelect(room)}
              />
            ))}
          </div>
        )}
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar
              name={user?.display_name || user?.username || 'U'}
              src={user?.avatar}
              size="md"
              isOnline={true}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-[var(--color-text)]">
                {user?.display_name || user?.username}
              </p>
              <p className="text-xs truncate text-[var(--color-text-muted)]">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-red-500"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </aside>
  );
}