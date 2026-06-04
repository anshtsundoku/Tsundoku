import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSetUser, useUser } from '../App.jsx';
import Interstitial from '../components/onboarding/Interstitial.jsx';
import StepShell from '../components/onboarding/StepShell.jsx';
import Welcome from '../components/onboarding/steps/Welcome.jsx';
import CreateDomain from '../components/onboarding/steps/CreateDomain.jsx';
import ConnectCredential from '../components/onboarding/steps/ConnectCredential.jsx';
import Done from '../components/onboarding/steps/Done.jsx';

// welcome → interstitial×6 between steps → domain → connect×4 → done
const PHASES = [
  'welcome',
  'interstitial-1',
  'domain',
  'interstitial-2',
  'youtube',
  'interstitial-3',
  'x',
  'interstitial-4',
  'gmail',
  'interstitial-5',
  'gemini',
  'interstitial-6',
  'done',
];

function phaseIndex(phase) {
  const i = PHASES.indexOf(phase);
  return i === -1 ? 0 : i;
}

// Persisted step encoding (server: users.onboarding_step). Interstitials don't
// get their own index — only these meaningful steps are saved/restored.
const PHASE_TO_STEP = { welcome: 0, domain: 1, youtube: 2, x: 3, gmail: 4, gemini: 5, done: 6 };
const STEP_TO_PHASE = ['welcome', 'domain', 'youtube', 'x', 'gmail', 'gemini', 'done'];

// Resolve the phase to resume at from a saved step. Clamp past-the-end values
// (e.g. step 6 while onboarded_at is somehow still null) back to the last
// meaningful skippable step so the user can still finish.
function resumePhase(step) {
  const s = Number.isInteger(step) ? Math.min(Math.max(step, 0), 5) : 0;
  return STEP_TO_PHASE[s] || 'welcome';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useUser();
  const setUser = useSetUser();
  const [phase, setPhase] = useState(() => resumePhase(user?.onboarding_step));
  const [finishing, setFinishing] = useState(false);

  const advance = useCallback(() => {
    const i = phaseIndex(phase);
    if (i < PHASES.length - 1) {
      const next = PHASES[i + 1];
      setPhase(next);
      // Persist progress for meaningful steps (skip interstitials).
      // Fire-and-forget — never block the UI; ignore failures.
      if (PHASE_TO_STEP[next] !== undefined) {
        api.setOnboardingStep(PHASE_TO_STEP[next]).catch(() => {});
      }
    }
  }, [phase]);

  const goBack = useCallback(() => {
    const i = phaseIndex(phase);
    if (i > 0) setPhase(PHASES[i - 1]);
  }, [phase]);

  // Swallow browser back — navigate internally instead.
  useEffect(() => {
    const push = () => window.history.pushState({ onboarding: true }, '');
    push();
    const onPop = () => {
      goBack();
      push();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [goBack]);

  const finish = async () => {
    setFinishing(true);
    try {
      await api.completeOnboarding();
      setUser({ ...user, onboarded_at: new Date().toISOString() });
      navigate('/', { replace: true });
    } catch {
      setFinishing(false);
    }
  };

  if (phase === 'welcome') {
    return <Welcome onBegin={advance} />;
  }

  const interMatch = phase.match(/^interstitial-(\d)$/);
  if (interMatch) {
    const n = Number(interMatch[1]);
    return <Interstitial stepNum={n} onContinue={advance} />;
  }

  if (phase === 'domain') {
    return (
      <CreateDomain
        stepNum={1}
        showBack
        onBack={goBack}
        onSuccess={advance}
      />
    );
  }

  if (phase === 'youtube') {
    return (
      <ConnectCredential
        stepNum={2}
        showBack
        onBack={goBack}
        onSuccess={advance}
        onSkip={advance}
        title="connect youtube."
        body="paste a youtube api key. tsundoku watches channels you choose and tells you when there's something new."
        kind="yt"
        fields={[{ key: 'value', placeholder: 'youtube api key' }]}
      />
    );
  }

  if (phase === 'x') {
    return (
      <ConnectCredential
        stepNum={3}
        showBack
        onBack={goBack}
        onSuccess={advance}
        onSkip={advance}
        title="connect x."
        body="x is loud. tsundoku quietens it."
        kind="twitter"
        fields={[
          { key: 'auth_token', placeholder: 'auth_token' },
          { key: 'ct0', placeholder: 'ct0' },
        ]}
      />
    );
  }

  if (phase === 'gmail') {
    return (
      <StepShell
        stepNum={4}
        showBack
        onBack={goBack}
        title="connect gmail."
        body="gmail integration is coming soon. skip for now — we'll let you know when it's live."
        primaryAction={
          <button
            type="button"
            onClick={advance}
            className="w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 transition-colors"
          >
            continue
          </button>
        }
      />
    );
  }

  if (phase === 'gemini') {
    return (
      <ConnectCredential
        stepNum={5}
        showBack
        onBack={goBack}
        onSuccess={advance}
        onSkip={advance}
        title="connect gemini."
        body="optional. lets tsundoku write tldrs for every new post."
        kind="gemini"
        fields={[{ key: 'value', placeholder: 'gemini api key' }]}
      />
    );
  }

  if (phase === 'done') {
    return <Done onFinish={finish} busy={finishing} />;
  }

  return null;
}
