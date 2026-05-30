import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/ui/Avatar";
import { ToggleField } from "../components/ui/ToggleField";
import { TextAreaField } from "../components/ui/TextAreaField";
import { InputField } from "../components/ui/InputField";
import { User, Save, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";


export function UserSettings() {
  const navigate = useNavigate();
  const {
    user,
    updateProfile,
    deleteAccount
  } = useAuthStore();
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(user?.avatar || null);
  const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true);
  const [pushNotifications, setPushNotifications] = useState(user?.push_notifications ?? true);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePassphrase, setDeletePassphrase] = useState("");
  const [deleting, setDeleting] = useState(false);


  const handleAvatarChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(file);
    setPreviewAvatar(URL.createObjectURL(file));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("display_name", displayName);
      formData.append("username", username);
      formData.append("bio", bio);
      formData.append("email_notifications", String(emailNotifications));
      formData.append("push_notifications", String(pushNotifications));
      if (avatar) formData.append("avatar", avatar);
      await updateProfile(formData);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || !deletePassphrase) {
      toast.error("Enter password and passphrase");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword, deletePassphrase);
      toast.success("Account deleted");
      navigate("/login");
    } catch {
      toast.error("Invalid password or passphrase");
    }
    setDeleting(false);
  };

  return (
    <div className="min-h-screen flex justify-center p-6 bg-pattern-1 transition-colors duration-300">
      <div className="w-full max-w-xl card flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded hover:bg-[var(--color-hover)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[var(--color-primary)]">
            <User className="w-6 h-6 text-[var(--color-secondary-text)]" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">User Settings</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Manage your account information</p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div onClick={() => fileInputRef.current?.click()} className="relative cursor-pointer group">
              <Avatar name={displayName || "User"} src={previewAvatar} size="xxl" isOnline />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-full flex items-center justify-center aspect-square">
                <span className="text-white text-sm">Change</span>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>

          {/* Inputs */}
          <InputField label="Display Name" value={displayName} onChange={setDisplayName} />

          <InputField label="Username" value={username} onChange={setUsername} />

          <TextAreaField label="Bio" value={bio} onChange={setBio} rows={3} />

          {/* Toggles */}
          <ToggleField label="Email Notifications" value={emailNotifications} onChange={setEmailNotifications} />

          <ToggleField label="Push Notifications" value={pushNotifications} onChange={setPushNotifications} />

          {/* Save */}
          <button type="submit" disabled={saving} className="w-full btn btn-submit">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </form>

        {/* Danger Zone */}
        <div className="p-6 border-t border-[var(--color-border)]">
          <button
            onClick={() => setDeleteModal(true)}
            className="btn btn-outline w-full"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal && <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-[var(--color-surface)] border-2 border-[var(--color-accent)] p-4 rounded w-full max-w-sm">
          <h3 className="text-center mb-4 text-xl font-bold text-[var(--color-text)]">Delete Account</h3>

          <div className="space-y-6">
            <InputField label="Password" value={deletePassword} onChange={setDeletePassword} type="password" />
            <InputField label="Passphrase" value={deletePassphrase} onChange={setDeletePassphrase} type="password" />
          </div>

          <div className="flex space-x-3 mt-4">
            <button onClick={() => setDeleteModal(false)} className="flex-1 btn btn-outline">
              Cancel
            </button>
            <button onClick={handleDeleteAccount} disabled={deleting} className="flex-1 btn btn-primary">
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}