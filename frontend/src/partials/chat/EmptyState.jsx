import { MessageSquare, Users, Zap } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--color-bg)]">
      <div className="text-center max-w-md px-6">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded mb-6"
          style={{
            background: `linear-gradient(to bottom right, var(--color-primary), var(--color-secondary))`
          }}
        >
          <MessageSquare className="w-10 h-10 text-[var(--color-secondary-text)]" />
        </div>

        <h2 className="text-2xl font-bold mb-3 text-[var(--color-text)]">
          Welcome to ChatApp
        </h2>

        <p className="mb-8 text-[var(--color-text-muted)]">
          Select a conversation from the sidebar to start chatting, or create a new chat to connect with someone.
        </p>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="card p-4">
            <Zap className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" />
            <p className="text-sm text-[var(--color-text)]">Real-time</p>
            <p className="text-xs text-[var(--color-text-muted)]">Instant messages</p>
          </div>
          <div className="card p-4">
            <Users className="w-6 h-6 mx-auto mb-2 text-[var(--color-online)]" />
            <p className="text-sm text-[var(--color-text)]">Online Status</p>
            <p className="text-xs text-[var(--color-text-muted)]">See who&apos;s active</p>
          </div>
          <div className="card p-4">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 text-[var(--color-secondary)]" />
            <p className="text-sm text-[var(--color-text)]">Typing</p>
            <p className="text-xs text-[var(--color-text-muted)]">Live indicators</p>
          </div>
        </div>
      </div>
    </div>
  );
}