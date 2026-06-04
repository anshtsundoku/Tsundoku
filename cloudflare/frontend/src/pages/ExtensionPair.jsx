import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { me } from '../lib/auth.js';
import { Brand } from '../App.jsx';

// Standalone, self-explanatory walkthrough (route /extension-pair). Adapts to
// whether the tsundoku browser extension is installed and already paired. The
// extension's content script injects window.__tsundokuExt into the page so we
// can detect its presence without any redirects.

const CONTACT_EMAIL = 'anshdwiv5@gmail.com';

// Small relative-time helper for the build timestamp (mirrors the one in
// PostCard). Lowercase, calm copy: "built just now" / "built 3h ago".
function builtAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'built just now';
  if (diff < 3600) return `built ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `built ${Math.floor(diff / 3600)}h ago`;
  return `built ${Math.floor(diff / 86400)}d ago`;
}

const SUBTITLES = {
  checking: 'checking for extension…',
  'not-installed': "let's get the extension installed first.",
  'installed-not-paired': 'the extension is installed. one more step.',
  paired: "you're set.",
};

export default function ExtensionPair() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [extensionState, setExtensionState] = useState('checking');
  const [approveStatus, setApproveStatus] = useState('idle'); // idle | pairing | waiting | timeout
  const [error, setError] = useState(null);
  const [extVersion, setExtVersion] = useState(null); // { version, built_at } | null

  // Version of the downloadable zip, generated at build time alongside the zip.
  // On failure we just render "version unknown" rather than blocking the page.
  useEffect(() => {
    let alive = true;
    fetch('/extension-version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => { if (alive) setExtVersion(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const waitTimer = useRef(null);
  const sessionPaired = useRef(false);

  // Require a signed-in user (pairing + pairings lookup need auth).
  useEffect(() => {
    let alive = true;
    me().then((u) => {
      if (!alive) return;
      if (!u) { navigate('/', { replace: true }); return; }
      setUser(u);
    });
    return () => { alive = false; };
  }, [navigate]);

  // Detection: existing pairing wins; otherwise wait up to 1.5s for the global.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    api.listPairings().then((rows) => {
      if (cancelled) return;
      if (Array.isArray(rows) && rows.length > 0) setExtensionState('paired');
    }).catch(() => {});

    const start = Date.now();
    const poll = () => {
      if (cancelled || sessionPaired.current) return;
      if (window.__tsundokuExt) {
        setExtensionState((s) => (s === 'paired' ? s : 'installed-not-paired'));
        return;
      }
      if (Date.now() - start >= 1500) {
        setExtensionState((s) => (s === 'checking' ? 'not-installed' : s));
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
    return () => { cancelled = true; };
  }, [user]);

  // While not installed, keep watching for up to 60s in case the user installs
  // the extension and the page picks it up without a manual refresh.
  useEffect(() => {
    if (extensionState !== 'not-installed') return;
    const start = Date.now();
    const id = setInterval(() => {
      if (window.__tsundokuExt) {
        clearInterval(id);
        setExtensionState((s) => (s === 'not-installed' ? 'installed-not-paired' : s));
      } else if (Date.now() - start > 60000) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [extensionState]);

  // The extension confirms once it has stored the token.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source === 'tsundoku-ext-installed' && event.data?.ok) {
        if (waitTimer.current) clearTimeout(waitTimer.current);
        sessionPaired.current = true;
        setApproveStatus('idle');
        setExtensionState('paired');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const approve = useCallback(async () => {
    setError(null);
    setApproveStatus('pairing');
    try {
      const { token } = await api.pairExtension({ name: navigator.userAgent });
      window.postMessage(
        { source: 'tsundoku-pair', token, userEmail: user?.email },
        window.location.origin,
      );
      setApproveStatus('waiting');
      waitTimer.current = setTimeout(() => {
        setApproveStatus((s) => (s === 'waiting' ? 'timeout' : s));
      }, 5000);
    } catch (e) {
      setError(e.message || 'could not start pairing');
      setApproveStatus('idle');
    }
  }, [user]);

  return (
    <main
      className="min-h-screen px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto py-12">
        <header className="text-center">
          <div className="text-wood mb-5 flex justify-center"><Brand size="lg" /></div>
          <h1 className="text-2xl font-bold tt-title tracking-tight lowercase">browser extension</h1>
          <p className="mt-2 text-sm text-muted">{SUBTITLES[extensionState]}</p>
        </header>

        <div className="mt-8 transition-opacity duration-300">
          {extensionState === 'checking' && <Checking />}
          {extensionState === 'not-installed' && <NotInstalled extVersion={extVersion} />}
          {extensionState === 'installed-not-paired' && (
            <InstalledNotPaired
              onApprove={approve}
              approveStatus={approveStatus}
              error={error}
            />
          )}
          {extensionState === 'paired' && <Paired />}
        </div>
      </div>
    </main>
  );
}

function Checking() {
  return (
    <div className="flex justify-center gap-1.5 py-10">
      <span className="w-2 h-2 rounded-full bg-wood/60 animate-pulse" />
      <span className="w-2 h-2 rounded-full bg-wood/60 animate-pulse [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-wood/60 animate-pulse [animation-delay:300ms]" />
    </div>
  );
}

function NotInstalled({ extVersion }) {
  const versionLabel = extVersion?.version ? `version ${extVersion.version}` : 'version unknown';
  const builtLabel = builtAgo(extVersion?.built_at);
  return (
    <div className="space-y-3">
      <NumberedCard n={1} title="download the extension">
        <p className="text-sm text-muted leading-relaxed">
          click below to get the latest version. it&apos;s a small zip file.
        </p>
        <a
          href="/tsundoku-extension.zip"
          download
          className="block w-full text-center bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 mt-3 hover:bg-wood-2 transition-colors"
        >
          download tsundoku.zip
        </a>
        <p className="mt-2 text-xs text-muted">
          {versionLabel}{builtLabel ? ` · ${builtLabel}` : ''}
        </p>
      </NumberedCard>

      <NumberedCard n={2} title="install in chrome">
        <ol className="space-y-2.5">
          <SubStep n={1}>unzip the file. you&apos;ll get a folder called &ldquo;extension&rdquo;.</SubStep>
          <SubStep n={2}>open <Mono>chrome://extensions</Mono> (paste in your address bar).</SubStep>
          <SubStep n={3}>top right: toggle on &ldquo;developer mode&rdquo;.</SubStep>
          <SubStep n={4}>click &ldquo;load unpacked&rdquo; → select the unzipped extension folder.</SubStep>
          <SubStep n={5}>the tsundoku icon appears in your toolbar. pin it.</SubStep>
        </ol>
        <p className="mt-3 text-xs text-muted leading-relaxed">
          works in chrome, edge, brave, arc. firefox needs a different file — coming later.
        </p>
      </NumberedCard>

      <NumberedCard n={3} title="come back here">
        <p className="text-sm text-muted leading-relaxed">
          once the extension is installed, refresh this page. you&apos;ll see the pair step appear automatically.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="block w-full text-center border border-wood text-wood font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 mt-3 hover:bg-wood/10 transition-colors"
        >
          refresh page
        </button>
      </NumberedCard>

      <p className="text-center text-xs text-muted pt-2">
        running into trouble? email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-wood hover:underline">{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}

function InstalledNotPaired({ onApprove, approveStatus, error }) {
  return (
    <PlainCard>
      <h2 className="text-lg font-bold tt-title tracking-tight lowercase text-ink">approve this browser</h2>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        clicking below tells tsundoku that this is one of your browsers. from now on, when you open x.com in
        this browser, your cookies sync automatically — no devtools, no copy-paste, no expiry hassle.
      </p>
      <button
        type="button"
        onClick={onApprove}
        disabled={approveStatus === 'pairing'}
        className="mt-5 w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-50 transition-colors"
      >
        {approveStatus === 'pairing' ? 'connecting…' : 'approve and connect'}
      </button>
      <p className="mt-3 text-xs text-muted">you can revoke this in settings any time.</p>
      {approveStatus === 'waiting' && <p className="mt-3 text-xs text-muted">waiting for the extension…</p>}
      {approveStatus === 'timeout' && (
        <p className="mt-3 text-xs text-muted leading-relaxed">
          didn&apos;t see the extension respond. make sure it&apos;s installed and active, then refresh this page.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-wood">{error}</p>}
    </PlainCard>
  );
}

function Paired() {
  return (
    <PlainCard>
      <h2 className="text-lg font-bold tt-title tracking-tight lowercase text-ink">extension paired.</h2>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        you can close this tab. open x.com once and your cookies will sync — give it about 10 seconds.
      </p>
      <p className="mt-3 text-xs text-muted leading-relaxed">
        next time you want to check status or disconnect, head to settings → browser extensions.
      </p>
      <Link
        to="/settings"
        className="mt-5 inline-block bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm px-6 py-3 hover:bg-wood-2 transition-colors"
      >
        back to settings
      </Link>
    </PlainCard>
  );
}

function NumberedCard({ n, title, children }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4 text-left">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-wood text-white text-xs font-bold shrink-0">
          {n}
        </span>
        <h2 className="text-ink font-bold tracking-tight lowercase">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SubStep({ n, children }) {
  return (
    <li className="flex gap-2.5 text-sm text-muted leading-relaxed">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-wood text-white text-xs font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Mono({ children }) {
  return (
    <span className="font-mono bg-wood/10 text-wood px-1.5 py-0.5 rounded text-xs break-all">{children}</span>
  );
}

function PlainCard({ children }) {
  return <div className="bg-bg border border-border rounded-lg p-5 text-center">{children}</div>;
}
