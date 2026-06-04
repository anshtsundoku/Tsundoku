import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useUser } from '../../App.jsx';
import { me, logout } from '../../lib/auth.js';

// Quiet, centered status indicator shown above the step title on every
// onboarding step. Deliberately not a header — fixed two-line height so it
// never pushes the layout around. Offers an inline "change email" affordance
// to switch Google accounts mid-wizard.
function AccountStatus() {
  const ctxUser = useUser();
  const [email, setEmail] = useState(ctxUser?.email ?? null);
  const [confirm, setConfirm] = useState(false);

  // Fallback: if the context user isn't available in this tree, resolve it
  // once and cache it. Rendering the email directly is fine — no flicker
  // concerns for a quiet status line.
  useEffect(() => {
    if (email) return;
    let alive = true;
    me().then((u) => {
      if (alive && u?.email) setEmail(u.email);
    });
    return () => { alive = false; };
  }, [email]);

  // Switch accounts: clear the JWT session (logout() hits /api/auth/logout and
  // drops the local token), then land on Landing so Google One Tap offers the
  // account picker. The old user's onboarding_step staying put is fine.
  const switchAccount = async () => {
    await logout();
    window.location.href = '/';
  };

  if (confirm) {
    return (
      <div className="text-center">
        <p className="text-xs text-muted">
          switch to a different account? you&apos;ll start onboarding over.
        </p>
        <div className="mt-0.5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={switchAccount}
            className="text-[11px] text-wood/80 hover:text-wood underline-offset-2 hover:underline"
          >
            yes, switch
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="text-[11px] text-muted hover:text-ink"
          >
            stay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs text-muted">
        setting up tsundoku for {email || '…'}.
      </p>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="mt-0.5 text-[11px] text-wood/80 hover:text-wood underline-offset-2 hover:underline"
      >
        change email
      </button>
    </div>
  );
}

export default function StepShell({
  stepNum,
  showBack,
  onBack,
  title,
  body,
  children,
  primaryAction,
  skipAction,
  hideAccount,
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
        {!hideAccount && <AccountStatus />}
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
