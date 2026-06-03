import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import {
    X, Edit2, Shield,
    ShieldCheck, User, Trash2, LogOut, UserMinus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useChatStore } from '../../stores/chatStore';
import { useNavigate } from 'react-router-dom';


export function ChatDetails({ room, onClose, currentUser }) {
    const myInfo = room.participants_info.find(p => p.user.id === currentUser?.id);
    const myRole = myInfo?.role;
    const leaveRoom = useChatStore(state => state.leaveRoom);
    const updateParticipantRole = useChatStore(state => state.updateParticipantRole);
    const removeParticipant = useChatStore(state => state.removeParticipant);
    const navigate = useNavigate();

    const isOwner = myRole === 'owner';
    const isAdmin = myRole === 'admin';
    const canManage = isOwner || isAdmin;
    const isDirect = room.room_type === 'direct';

    const ownersCount = room.participants_info.filter(p => p.role === 'owner').length;
    const participantCount = room.participants_info?.length || 0;

    const RoleBadge = ({ role }) => {
        if (role === 'owner') return <span className="flex items-center text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3 mr-1" /> Owner</span>;
        if (role === 'admin') return <span className="flex items-center text-[10px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full"><Shield className="w-3 h-3 mr-1" /> Admin</span>;
        return <span className="flex items-center text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full"><User className="w-3 h-3 mr-1" /> Member</span>;
    };

    const handleLeaveGroup = async () => {
        try {
            await leaveRoom(room.id);
            toast.success('left the group');
            onClose?.();
            navigate('/chat');
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                'Failed to leave'
            );
        }
    };

    const handleKick = (userId) => {
        removeParticipant(room.id, userId);
    };

    const handlePromote = (userId) => {
        updateParticipantRole(room.id, userId, 'admin');
    };


    return (
        <div className="fixed inset-0 z-40 flex">
            <div className="flex-1 bg-black/50" onClick={onClose} />

            <div className="w-80 card border-l p-4 z-50 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-[var(--color-text)]">{isDirect ? 'User Info' : 'Group Info'}</h2>
                    <button onClick={onClose} className="btn btn-danger !p-1"><X /></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center relative">
                        <div className="relative group">
                            <Avatar name={room.display_name} src={room.display_avatar} size="xl" />
                        </div>

                        <div className="mt-3 flex items-center space-x-2">
                            <h3 className="text-base font-semibold">{room.display_name}</h3>
                        </div>

                        {!isDirect && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{participantCount} members</p>
                        )}
                    </div>

                    {/* Description Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-[var(--color-text-muted)]">About</h4>
                        </div>
                        <div className="card p-3 text-sm shadow-none">
                            {room.description || 'No description ...'}
                        </div>
                    </div>

                    {/* Members List - Only for Groups */}
                    {!isDirect && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-[var(--color-text-muted)]">Members</h4>
                            </div>

                            <div className="space-y-3">
                                {room.participants_info.map((p) => (
                                    <div key={p.user.id} className="flex items-center justify-between group">
                                        <div className="flex items-center space-x-3">
                                            <Avatar name={p.user.display_name} src={p.user.avatar} size="sm" />
                                            <div>
                                                <div className="text-sm font-medium">{p.user.display_name}</div>
                                                <RoleBadge role={p.role} />
                                            </div>
                                        </div>

                                        {/* Actions for Members */}
                                        {p.user.id !== currentUser?.id && (
                                            <div className="hidden group-hover:flex items-center space-x-2">
                                                {isOwner && p.role === 'member' && (
                                                    <button
                                                        title="Promote to Admin"
                                                        onClick={() => handlePromote(p.user.id)}
                                                        className="btn-icon p-1"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {((isOwner && p.role !== 'owner') || (isAdmin && p.role === 'member')) && (
                                                    <button
                                                        title="Kick"
                                                        onClick={() => handleKick(p.user.id)}
                                                        className="btn-icon p-1"
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons (Footer) */}
                <div className="mt-auto pt-4 border-t border-[var(--color-border)] space-y-2">
                    {isDirect ? (
                        // Direct Chat Actions
                        <button
                            onClick={handleLeaveGroup}
                            className="btn-danger w-full flex items-center justify-center">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Chat
                        </button>
                    ) : (
                        // Group Chat Actions
                        <>
                            {canManage && (
                                <button
                                    onClick={() => navigate(`/chat/${room.id}/settings`)}
                                    className="btn btn-outline w-full flex items-center justify-center">
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit Group
                                </button>
                            )}
                            {(isOwner && ownersCount == 1) && (
                                <button
                                    onClick={handleLeaveGroup}
                                    className="btn-danger w-full flex items-center justify-center">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                                </button>
                            )}
                            {(!isOwner || ownersCount > 1) && (
                                <button
                                    onClick={handleLeaveGroup}
                                    className="btn btn-outline w-full flex items-center justify-center">
                                    <LogOut className="w-4 h-4 mr-2" /> Leave Group
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div >
    );
}
