import { ChevronLeft } from 'lucide-react';

export default function StepShell({
  stepNum,
  showBack,
  onBack,
  title,
  body,
  children,
  primaryAction,
  skipAction,
}) {
  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex-1 w-full max-w-md mx-auto px-6 py-6 flex flex-col">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 -ml-1 p-1 text-muted hover:text-ink transition-colors"
            aria-label="back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="tt-title text-3xl font-bold tracking-tight lowercase">{title}</h1>
        <p className="mt-4 text-sm text-muted leading-relaxed">{body}</p>
        <div className="mt-8 flex-1">{children}</div>
        <div className="mt-6 space-y-3">
          {primaryAction}
          {skipAction}
        </div>
      </div>
      {stepNum != null && (
        <p className="text-center text-[10px] text-muted pb-4 tracking-wide">
          step {stepNum} of 6
        </p>
      )}
    </div>
  );
}
