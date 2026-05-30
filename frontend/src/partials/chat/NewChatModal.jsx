import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useChatStore } from '../../stores/chatStore';
import { Avatar } from '../../components/ui/Avatar';
import { X, Search, Loader2, Users, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export function NewChatModal({ onClose }) {
  const navigate = useNavigate();
  const { createRoom, createDirectMessage } = useChatStore();

  const [mode, setMode] = useState("direct");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [description, setDescription] = useState("");

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search users with debounce
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setUsers([]);
        return;
      }
      setIsLoading(true);
      try {
        const results = await authApi.searchUsers(searchQuery);
        setUsers(Array.isArray(results) ? results : results.results || []);
      } catch {
        toast.error("Failed to search users");
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleToggleUser = (id) => {
    if (mode === "direct") return handleCreateDirect(id);
    setSelectedUsers((prev) =>
      prev.includes(id)
        ? prev.filter((uid) => uid !== id)
        : [...prev, id]
    );
  };

  const handleCreateDirect = async (userId) => {
    setIsCreating(true);
    try {
      const room = await createDirectMessage(userId);
      onClose();
      navigate(`/chat/${room.id}`);
    } catch {
      toast.error("Failed to create conversation");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) return toast.error("Select at least 2 users");
    if (!groupName.trim()) return toast.error("Group needs a name");

    setIsCreating(true);
    try {
      const room = await createRoom(groupName, selectedUsers, description);
      onClose();
      navigate(`/chat/${room.id}`);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded card overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {mode === "direct" ? "New Conversation" : "New Group"}
          </h2>

          <button
            onClick={onClose}
            className="btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center p-4 gap-2">
          <button
            onClick={() => setMode("direct")}
            className={`btn flex-1 ${mode === "direct" ? "btn-primary" : "btn-outline"}`}
          >
            <MessageSquare className="w-4 h-4" /> Direct
          </button>

          <button
            onClick={() => setMode("group")}
            className={`btn flex-1 ${mode === "group" ? "btn-primary" : "btn-outline"}`}
          >
            <Users className="w-4 h-4" /> Group
          </button>
        </div>

        {/* Group Name */}
        {mode === "group" && (
          <div className="px-4 pb-2">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name..."
              className="input"
            />
          </div>
        )}

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-80 overflow-y-auto">

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Type at least 2 characters to search
            </div>
          ) : (
            <div>
              {users.map((user) => {
                const isSelected = selectedUsers.includes(user.id);

                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    disabled={isCreating}
                    className={`w-full p-4 flex items-center gap-3 transition-colors text-left text-[var(--color-text)]
                      ${isSelected && mode === "group"
                        ? "bg-primary-600/20 dark:bg-primary-600/20"
                        : "hover:bg-black/5 dark:hover:bg-white/5"}
                      disabled:opacity-50`}
                  >
                    <Avatar
                      name={user.display_name || user.username}
                      src={user.avatar}
                      size="md"
                      isOnline={user.is_online}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-sm opacity-70 truncate">@{user.username}</p>
                    </div>

                    {mode === "group" && isSelected && (
                      <span
                        className="px-2 py-1 text-xs rounded-full bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                      >
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Group */}
        {mode === "group" && (
          <div className="p-4 border-t" style={{ borderColor: "var(--color-border)" }}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Group description (optional)"
              className="input w-full"
            />

            <button
              onClick={handleCreateGroup}
              disabled={isCreating}
              className="btn btn-submit mt-3"
            >
              Create Group
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
