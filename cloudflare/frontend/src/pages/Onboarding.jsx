import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSetUser, useUser } from '../App.jsx';
import Interstitial from '../components/onboarding/Interstitial.jsx';
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

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useUser();
  const setUser = useSetUser();
  const [phase, setPhase] = useState('welcome');
  const [finishing, setFinishing] = useState(false);

  const advance = useCallback(() => {
    const i = phaseIndex(phase);
    if (i < PHASES.length - 1) setPhase(PHASES[i + 1]);
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
      <ConnectCredential
        stepNum={4}
        showBack
        onBack={goBack}
        onSuccess={advance}
        onSkip={advance}
        title="connect gmail."
        body="newsletters belong in tsundoku, not your inbox. full gmail sync is still coming — you can wire an app password early if you want."
        kind="gmail"
        fields={[{ key: 'value', placeholder: 'gmail app password' }]}
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
