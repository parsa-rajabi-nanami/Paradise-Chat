import { MessageSquare, Users, Zap, Plus } from 'lucide-react';

export function EmptyState({
  title = "Welcome to ChatApp",
  description = "Select a conversation from the sidebar to start chatting, or create a new chat to connect with someone.",
  onNewChat,
}) {
  const featureList = [
    {
      icon: Zap,
      title: "Real-time",
      desc: "Instant messaging",
      color: "text-[var(--color-accent,#f59e0b)]",
    },
    {
      icon: Users,
      title: "Online Status",
      desc: "See active users",
      color: "text-[var(--color-online,#10b981)]",
    },
    {
      icon: MessageSquare,
      title: "Typing",
      desc: "Live indicators",
      color: "text-[var(--color-secondary,#6366f1)]",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 h-full w-full min-h-0 bg-[var(--color-bg)] select-none">
      <div className="text-center max-w-md w-full my-auto flex flex-col items-center">
        {/* Gradient Hero Badge */}
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg shadow-[var(--color-primary)]/10 transition-transform hover:scale-105"
          style={{
            background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`,
          }}
        >
          <MessageSquare className="w-10 h-10 text-[var(--color-secondary-text,#ffffff)]" />
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-2xl font-bold mb-2 text-[var(--color-text)] tracking-tight">
          {title}
        </h2>

        <p className="mb-6 text-sm text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>

        {/* Primary CTA Button */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="mb-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-[var(--color-primary)] hover:opacity-90 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Start New Chat
          </button>
        )}

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {featureList.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-sm hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface)] transition-all duration-200"
              >
                <Icon className={`w-5 h-5 mx-auto mb-1.5 ${item.color}`} />
                <p className="text-xs font-semibold text-[var(--color-text)]">
                  {item.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}