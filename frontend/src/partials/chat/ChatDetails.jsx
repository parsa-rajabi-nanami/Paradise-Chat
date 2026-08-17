import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  X,
  Edit2,
  Shield,
  ShieldCheck,
  User,
  Trash2,
  LogOut,
  UserMinus,
  ShieldOff,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { useChatStore } from '../../stores/chatStore';

const RoleBadge = ({ role }) => {
  if (role === 'owner') {
    return (
      <span className="inline-flex items-center text-[10px] font-medium bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
        <ShieldCheck className="w-3 h-3 mr-1" /> Owner
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center text-[10px] font-medium bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full">
        <Shield className="w-3 h-3 mr-1" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-medium bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">
      <User className="w-3 h-3 mr-1" /> Member
    </span>
  );
};

export function ChatDetails({ room, onClose, currentUser }) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveRoom = useChatStore((state) => state.leaveRoom);
  const updateParticipantRole = useChatStore((state) => state.updateParticipantRole);
  const removeParticipant = useChatStore((state) => state.removeParticipant);

  const participants = room?.participants_info || [];
  const myInfo = participants.find((p) => p.user?.id === currentUser?.id);
  const myRole = myInfo?.role;

  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = isOwner || isAdmin;
  const isDirect = room?.room_type === 'direct';

  const ownersCount = participants.filter((p) => p.role === 'owner').length;
  const participantCount = participants.length;

  const handleLeaveOrDelete = async () => {
    const actionText = isDirect
      ? 'delete this chat'
      : isOwner && ownersCount === 1
      ? 'delete this group'
      : 'leave this group';

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    setIsSubmitting(true);
    try {
      await leaveRoom(room.id);
      toast.success(isDirect ? 'Chat deleted' : 'Successfully left group');
      onClose?.();
      navigate('/chat');
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${actionText}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKick = async (userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this group?`)) return;

    try {
      await removeParticipant(room.id, userId);
      toast.success(`${userName} removed`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove participant');
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    try {
      await updateParticipantRole(room.id, userId, newRole);
      toast.success(`Updated ${userName}'s role to ${newRole}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <div className="relative w-80 max-w-full bg-[var(--color-surface)] border-l border-[var(--color-border)] p-4 flex flex-col h-full z-10 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-base text-[var(--color-text)]">
            {isDirect ? 'User Info' : 'Group Info'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <Avatar name={room?.display_name} src={room?.display_avatar} size="xl" />
            <h3 className="mt-3 text-base font-semibold text-[var(--color-text)] text-center">
              {room?.display_name}
            </h3>
            {!isDirect && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {participantCount} {participantCount === 1 ? 'member' : 'members'}
              </p>
            )}
          </div>

          {/* Description / About Section */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              About
            </h4>
            <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] text-sm text-[var(--color-text)] leading-relaxed">
              {room?.description || 'No description provided.'}
            </div>
          </div>

          {/* Members List (Groups Only) */}
          {!isDirect && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Members
              </h4>

              <div className="space-y-2">
                {participants.map((p) => {
                  const targetUser = p.user;
                  const isSelf = targetUser?.id === currentUser?.id;

                  return (
                    <div
                      key={targetUser?.id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] group transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <Avatar name={targetUser?.display_name} src={targetUser?.avatar} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate">
                            {targetUser?.display_name} {isSelf && '(You)'}
                          </p>
                          <RoleBadge role={p.role} />
                        </div>
                      </div>

                      {/* Management Action Buttons */}
                      {!isSelf && (
                        <div className="flex items-center space-x-1 md:hidden md:group-hover:flex">
                          {/* Promote / Demote Controls */}
                          {isOwner && p.role === 'member' && (
                            <button
                              title="Promote to Admin"
                              onClick={() => handleRoleChange(targetUser.id, 'admin', targetUser.display_name)}
                              className="p-1 rounded hover:bg-[var(--color-surface)] text-blue-500 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {isOwner && p.role === 'admin' && (
                            <button
                              title="Demote to Member"
                              onClick={() => handleRoleChange(targetUser.id, 'member', targetUser.display_name)}
                              className="p-1 rounded hover:bg-[var(--color-surface)] text-amber-500 transition-colors"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}

                          {/* Kick Control */}
                          {((isOwner && p.role !== 'owner') || (isAdmin && p.role === 'member')) && (
                            <button
                              title="Remove Member"
                              onClick={() => handleKick(targetUser.id, targetUser.display_name)}
                              className="p-1 rounded hover:bg-[var(--color-surface)] text-red-500 transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="mt-auto pt-4 border-t border-[var(--color-border)] space-y-2">
          {!isDirect && canManage && (
            <button
              onClick={() => navigate(`/chat/${room.id}/settings`)}
              className="btn btn-outline w-full flex items-center justify-center gap-2 py-2"
            >
              <Edit2 className="w-4 h-4" /> Edit Group
            </button>
          )}

          <button
            onClick={handleLeaveOrDelete}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors font-medium text-sm ${
              isDirect || (isOwner && ownersCount === 1)
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'btn btn-outline text-red-500 border-red-500/30 hover:bg-red-500/10'
            }`}
          >
            {isDirect ? (
              <>
                <Trash2 className="w-4 h-4" /> Delete Chat
              </>
            ) : isOwner && ownersCount === 1 ? (
              <>
                <Trash2 className="w-4 h-4" /> Delete Group
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" /> Leave Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}