export default function Done({ onFinish, busy }) {
  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center px-6 onboarding-fade-in"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="w-full max-w-md">
        <h1 className="tt-title text-3xl font-bold tracking-tight lowercase">you&apos;re set.</h1>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          your reads will arrive here. push on, push off — your call.
        </p>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          don&apos;t worry about emptying it.
        </p>
        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className="mt-10 w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : 'into the pile'}
        </button>
      </div>
    </div>
  );
}
