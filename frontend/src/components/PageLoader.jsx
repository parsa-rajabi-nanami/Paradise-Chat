export function PageLoader() {
  return (
    <div 
      className="flex items-center justify-center min-h-screen w-full bg-[var(--color-bg)]"
      role="status"
      aria-label="Loading"
    >
      <div className="w-10 h-10 border-4 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}