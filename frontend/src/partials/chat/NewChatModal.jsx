import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useChatStore } from '../../stores/chatStore';
import { Avatar } from '../../components/ui/Avatar';
import { X, Search, Loader2, Users, MessageSquare, Check, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function NewChatModal({ onClose }) {
  const navigate = useNavigate();
  const createRoom = useChatStore((state) => state.createRoom);
  const createDirectMessage = useChatStore((state) => state.createDirectMessage);

  const [mode, setMode] = useState('direct'); // 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]); // Array of user objects

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const searchInputRef = useRef(null);

  // Auto-focus search input on mount / mode switch
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [mode]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Search users with debounce & stale response protection
  useEffect(() => {
    let isCurrent = true;

    if (searchQuery.trim().length < 2) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await authApi.searchUsers(searchQuery);
        if (isCurrent) {
          const list = Array.isArray(results) ? results : results.results || [];
          setUsers(list);
        }
      } catch {
        if (isCurrent) toast.error('Failed to search users');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSearchQuery('');
    setUsers([]);
  };

  const toggleSelectUser = (user) => {
    if (mode === 'direct') {
      handleCreateDirect(user.id);
      return;
    }

    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleRemoveSelectedUser = (userId) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreateDirect = async (userId) => {
    setIsCreating(true);
    try {
      const room = await createDirectMessage(userId);
      onClose();
      navigate(`/chat/${room.id}`);
    } catch {
      toast.error('Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      return toast.error('Select at least 2 users for a group');
    }
    if (!groupName.trim()) {
      return toast.error('Group requires a name');
    }

    setIsCreating(true);
    try {
      const userIds = selectedUsers.map((u) => u.id);
      const room = await createRoom(groupName.trim(), userIds, description.trim());
      onClose();
      navigate(`/chat/${room.id}`);
    } catch {
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {mode === 'direct' ? 'New Message' : 'New Group Chat'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="p-3 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
          <div className="flex p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => handleModeChange('direct')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all',
                mode === 'direct'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <MessageSquare className="w-4 h-4" /> Direct
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('group')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all',
                mode === 'group'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <Users className="w-4 h-4" /> Group
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Group Inputs (Group Mode Only) */}
          {mode === 'group' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Team"
                  className="w-full text-sm p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Selected User Chips */}
              {selectedUsers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                    Selected Members ({selectedUsers.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                    {selectedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 font-medium"
                      >
                        {user.display_name || user.username}
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedUser(user.id)}
                          className="p-0.5 rounded-full hover:bg-[var(--color-primary)]/20 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or @username..."
              className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* User Search Results */}
          <div className="space-y-1 min-h-[160px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)] space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                <span className="text-xs">Searching users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--color-text-muted)]">
                {searchQuery.trim().length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No users found'}
              </div>
            ) : (
              users.map((user) => {
                const isSelected = selectedUsers.some((u) => u.id === user.id);

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleSelectUser(user)}
                    disabled={isCreating}
                    className={clsx(
                      'w-full p-2.5 rounded-xl flex items-center gap-3 transition-colors text-left',
                      isSelected
                        ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30'
                        : 'hover:bg-[var(--color-surface-hover)]'
                    )}
                  >
                    <Avatar
                      name={user.display_name || user.username}
                      src={user.avatar}
                      size="md"
                      isOnline={user.is_online}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        @{user.username}
                      </p>
                    </div>

                    {mode === 'group' && (
                      <div
                        className={clsx(
                          'w-5 h-5 rounded-md flex items-center justify-center border transition-colors',
                          isSelected
                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                            : 'border-[var(--color-border)] text-transparent'
                        )}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Group Description */}
          {mode === 'group' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group about?"
                rows={2}
                className="w-full text-sm p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          )}
        </div>

        {/* Modal Footer (Group Submit) */}
        {mode === 'group' && (
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={isCreating || selectedUsers.length < 2 || !groupName.trim()}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2',
                !isCreating && selectedUsers.length >= 2 && groupName.trim()
                  ? 'bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Group ({selectedUsers.length})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}