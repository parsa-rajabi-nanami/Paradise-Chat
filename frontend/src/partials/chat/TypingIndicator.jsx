export function TypingIndicator({ users = [] }) {
  if (!users || users.length === 0) return null;

  const getTypingText = () => {
    const names = users.map((u) => u.display_name || u.username || 'Someone');

    if (names.length === 1) {
      return `${names[0]} is typing`;
    }
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing`;
    }
    return `${names[0]} and ${names.length - 1} others are typing`;
  };

  return (
    <div
      aria-live="polite"
      className="px-4 py-1.5 flex items-center space-x-2 text-[var(--color-text-muted)] select-none transition-all duration-200"
    >
      {/* Animated Dots Container */}
      <div className="flex items-center space-x-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>

      {/* Typing Text */}
      <span className="text-xs font-medium italic">{getTypingText()}...</span>
    </div>
  );
}