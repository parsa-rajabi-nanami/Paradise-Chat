import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { Avatar } from "../components/ui/Avatar";
import { InputField } from "../components/ui/InputField";
import { TextAreaField } from "../components/ui/TextAreaField";
import { ArrowLeft, Save, Loader2, Users, Search, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../api/auth";


export function ChatSettings() {
  const { roomId } = useParams();
  const { rooms, updateRoom, addParticipant } = useChatStore();
  const room = rooms.find(r => String(r.id) === String(roomId));
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  useEffect(() => {
    if (room) {
      setName(room.name || "");
      setDescription(room.description || "");
      setPreviewAvatar(room.display_avatar || null);
    }
  }, [room]);

  useEffect(() => {
    return () => {
      if (previewAvatar?.startsWith("blob:")) {
        URL.revokeObjectURL(previewAvatar);
      }
    };
  }, [previewAvatar]);

  useEffect(() => {
    if (!searchQuery.trim() || !room) {
      setUsers([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        setIsSearching(true);

        const response = await authApi.searchUsers(searchQuery);
        const results = Array.isArray(response) ? response : response?.results || [];

        const existingIds = room?.participants_info?.map(p => p.user?.id) || [];

        const filtered = results.filter(
          u => !existingIds.includes(u.id)
        );

        setUsers(filtered);
      } catch {
        setUsers([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delay);

  }, [searchQuery, room]);



  const handleAvatarChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image allowed");
      return;
    }

    setAvatar(file);
    setPreviewAvatar(URL.createObjectURL(file));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("name", name);
      formData.append("description", description);
      if (avatar) formData.append("avatar", avatar);

      await updateRoom(roomId, formData);

      toast.success("Group updated");
    } catch {
      toast.error("Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (user) => {
    try {
      await addParticipant(room.id, user);

      toast.success("User added to group");

      setSearchQuery("");
      setUsers([]);
    } catch {
      toast.error("Failed to add user");
    }
  };


  if (!room) {
    return <div className="p-6 text-center">Group not found</div>;
  }

  return (
    <div className="min-h-screen flex justify-center p-6 bg-pattern-1">
      <div className="w-full max-w-xl card flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center space-x-3">

          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded hover:bg-[var(--color-hover)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[var(--color-primary)]">
            <Users className="w-6 h-6 text-[var(--color-secondary-text)]" />
          </div>

          <div>
            <h1 className="text-xl font-bold">Group Settings</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Edit group information
            </p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center">

            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative cursor-pointer group"
            >
              <Avatar name={name} src={previewAvatar} size="xxl" />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-full flex items-center justify-center">
                <span className="text-white text-sm">Change</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <InputField
            label="Group Name"
            value={name}
            onChange={setName}
          />

          <TextAreaField
            label="Description"
            value={description}
            onChange={setDescription}
            rows={3}
          />

          {/* Add Member */}
          <div className="space-y-3">

            <label className="text-sm font-medium">
              Add Member
            </label>

            <div className="relative">

              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />

              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="input pl-9 w-full"
              />

            </div>

            {isSearching && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Searching...
              </p>
            )}

            {users.length > 0 && (
              <div className="border border-[var(--color-border)] rounded max-h-48 overflow-y-auto">

                {users.map(user => (

                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAddUser(user)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-hover)]"
                  >

                    <div className="flex items-center space-x-3">

                      <Avatar
                        src={user.avatar}
                        name={user.username}
                        size="sm"
                      />

                      <span>{user.username}</span>

                    </div>

                    <UserPlus className="w-4 h-4 text-green-500" />

                  </button>

                ))}

              </div>
            )}

          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full btn btn-submit"
          >
            {saving
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Save className="w-5 h-5" />
            }

            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>

        </form>

      </div>
    </div>
  );
}
