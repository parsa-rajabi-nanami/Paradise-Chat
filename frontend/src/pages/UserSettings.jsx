import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/ui/Avatar";
import { ToggleField } from "../components/ui/ToggleField";
import { TextAreaField } from "../components/ui/TextAreaField";
import { InputField } from "../components/ui/InputField";
import { User, Save, Trash2, ArrowLeft, Loader2, Camera, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export function UserSettings() {
  const navigate = useNavigate();
  const { user, updateProfile, deleteAccount } = useAuthStore();
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

  // Synchronize state if user profile object finishes loading asynchronously
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setUsername(user.username || "");
      setBio(user.bio || "");
      if (!avatar) setPreviewAvatar(user.avatar || null);
      setEmailNotifications(user.email_notifications ?? true);
      setPushNotifications(user.push_notifications ?? true);
    }
  }, [user, avatar]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewAvatar && previewAvatar.startsWith("blob:")) {
        URL.revokeObjectURL(previewAvatar);
      }
    };
  }, [previewAvatar]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewAvatar && previewAvatar.startsWith("blob:")) {
      URL.revokeObjectURL(previewAvatar);
    }

    setAvatar(file);
    setPreviewAvatar(URL.createObjectURL(file));
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
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
      toast.success("Profile updated successfully");
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModal(false);
    setDeletePassword("");
    setDeletePassphrase("");
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword || !deletePassphrase) {
      toast.error("Please enter both password and passphrase");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deletePassword, deletePassphrase);
      toast.success("Account deleted successfully");
      navigate("/login");
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Invalid password or passphrase";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center p-6 bg-pattern-1 transition-colors duration-300">
      <div className="w-full max-w-xl card flex flex-col h-fit">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving || deleting}
            className="p-2 rounded hover:bg-[var(--color-hover)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
            title="Back"
            aria-label="Go back"
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={handleTriggerFileInput}
              disabled={saving}
              className="relative cursor-pointer group rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              aria-label="Change profile avatar"
            >
              <Avatar name={displayName || user?.username || "User"} src={previewAvatar} size="xxl" isOnline />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-full flex flex-col items-center justify-center text-white">
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">Change</span>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Form Fields */}
          <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
            <InputField label="Display Name" value={displayName} onChange={setDisplayName} />

            <InputField label="Username" value={username} onChange={setUsername} />

            <TextAreaField label="Bio" value={bio} onChange={setBio} rows={3} />

            <ToggleField
              label="Email Notifications"
              value={emailNotifications}
              onChange={setEmailNotifications}
            />

            <ToggleField
              label="Push Notifications"
              value={pushNotifications}
              onChange={setPushNotifications}
            />
          </fieldset>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full btn btn-submit flex items-center justify-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>

        {/* Danger Zone */}
        <div className="p-6 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setDeleteModal(true)}
            disabled={saving}
            className="btn btn-outline w-full flex items-center justify-center space-x-2 text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-lg w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-[var(--color-danger)] flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 id="delete-modal-title" className="text-xl font-bold text-[var(--color-text)]">
                Delete Account
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                This action is permanent and cannot be undone. Please verify your credentials.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <InputField
                label="Password"
                value={deletePassword}
                onChange={setDeletePassword}
                type="password"
                disabled={deleting}
              />
              <InputField
                label="Security Passphrase"
                value={deletePassphrase}
                onChange={setDeletePassphrase}
                type="password"
                disabled={deleting}
              />

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="flex-1 btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="flex-1 btn btn-danger flex items-center justify-center space-x-2 bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
