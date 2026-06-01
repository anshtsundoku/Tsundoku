import { Brand } from '../../../App.jsx';

export default function Welcome({ onBegin }) {
  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center px-6 onboarding-fade-in"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="w-full max-w-md text-center">
        <div className="text-wood mb-8 flex justify-center">
          <Brand size="hero" />
        </div>
        <h1 className="tt-title text-4xl font-bold tracking-tight lowercase">welcome.</h1>
        <p className="mt-5 text-sm text-muted leading-relaxed">
          tsundoku is a quiet feed of the few sources you trust.
        </p>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          let&apos;s set yours up — six small steps.
        </p>
        <button
          type="button"
          onClick={onBegin}
          className="mt-10 w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 transition-colors"
        >
          begin
        </button>
      </div>
    </div>
  );
}
