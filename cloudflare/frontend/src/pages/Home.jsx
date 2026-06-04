import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { usePullToRefresh } from '../lib/pullToRefresh.js';
import { DomainIcon, PlusIcon } from '../components/Icons.jsx';
import DomainModal from '../components/DomainModal.jsx';
import { typeLabel, VISIBLE_TYPES } from '../lib/labels.js';
import { SkeletonGrid } from '../components/Skeleton.jsx';
import { getPushStatus, subscribeToPush } from '../lib/push.js';

// Shared with the Sources.jsx post-add-source nudge so the user isn't
// double-prompted: dismissing/accepting here also retires that nudge.
const BANNER_DISMISSED_KEY = 'tsundoku.push.banner.dismissed';
const SOURCES_NUDGE_KEY = 'tsundoku.push.nudged';
function bannerDismissed() {
  try { return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'; } catch { return false; }
}
function dismissBanner() {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    localStorage.setItem(SOURCES_NUDGE_KEY, '1');
  } catch { /* ignore */ }
}

export default function Home() {
  const [domains, setDomains] = useState([]);
  const [sources, setSources] = useState([]);
  const [typeCounts, setTypeCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [push, setPush] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(bannerDismissed());

  const reloadPush = async () => {
    try { setPush(await getPushStatus()); } catch { /* ignore */ }
  };
  useEffect(() => { reloadPush(); }, []);

  const load = async () => {
    try {
      const [ds, ss, tc] = await Promise.all([
        api.listDomains(),
        api.listSources().catch(() => []),    // tolerated; empty for brand-new users
        api.sourceCounts().catch(() => []),    // optional; tolerated if endpoint missing
      ]);
      setDomains(Array.isArray(ds) ? ds : []);
      setSources(Array.isArray(ss) ? ss : []);
      setTypeCounts(Array.isArray(tc) ? tc : []);
      setError(null);
    } catch (e) {
      console.error('Home: failed to load', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  usePoll(load, 15000, []);
  const pull = usePullToRefresh(load);

  if (loading) return <SkeletonGrid n={8} />;
  if (error)   return <div className="text-wood text-sm">Couldn't load: {error}</div>;

  // Build the "New Reads/Watches" row — one pill per visible source type,
  // ordered consistently. Pills appear whether or not there are unread items
  // (a zero-count pill is still useful: "yes, you have X sources").
  const countByType = Object.fromEntries((typeCounts || []).map(r => [r.type, r.unread_count]));
  const visibleTypes = VISIBLE_TYPES.filter(t => (countByType[t] || 0) >= 0); // keep all

  // Cheap "has content" signal: any unread across the source types we already
  // fetched (no extra request). Stands in for posts.length >= 1.
  const hasPosts = (typeCounts || []).some(r => (r.unread_count || 0) >= 1);

  // Contextual push prompt — only when there's something to be pinged about and
  // push is actually turn-on-able on this device.
  const showPushBanner =
    !bannerHidden && push &&
    sources.length >= 1 && hasPosts &&
    push.supported && !push.subscribed &&
    push.permission !== 'denied' && !push.iosNeedsInstall;

  // iOS-only variant: can't subscribe until installed to the home screen.
  const showIosInstallBanner =
    !bannerHidden && push && push.iosNeedsInstall &&
    sources.length >= 1 && hasPosts;

  const acceptPushBanner = async () => {
    setPushBusy(true);
    try {
      await subscribeToPush();
      await reloadPush();
    } catch { /* leave banner; user can retry from settings */ }
    finally {
      dismissBanner();
      setBannerHidden(true);
      setPushBusy(false);
    }
  };

  const declinePushBanner = () => {
    dismissBanner();
    setBannerHidden(true);
  };

  // Zero-domain empty state: a single, friendly CTA.
  if (domains.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center text-center py-16 px-4">
          <BookPlus className="w-16 h-16 text-wood mb-6" aria-hidden="true" />
          <h2 className="tt-title text-2xl font-bold tracking-tight mb-3">no domains yet.</h2>
          <p className="text-sm text-muted max-w-sm leading-relaxed mb-6">
            domains are buckets for the things you read. tech, geopolitics, whatever. start with one.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 transition-colors"
          >
            create your first domain
          </button>
        </div>
        {modalOpen && (
          <DomainModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />
        )}
      </>
    );
  }

  // Has domains but no sources yet (common right after onboarding when the
  // user skipped every credential/source step) — show a polished empty state.
  const noSources = domains.length > 0 && sources.length === 0;

  if (noSources) {
    return (
      <div {...pull.handlers}>
        <PullSpinner pull={pull} />
        <div className="relative flex flex-col items-center text-center py-20 px-4">
          {/* Decorative books behind the copy. */}
          <svg
            viewBox="0 0 90 120" width="90" height="120" aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 top-8 text-wood pointer-events-none"
            style={{ opacity: 0.15 }}
          >
            <rect x="6"  y="14" width="20" height="96"  rx="3" fill="currentColor" />
            <rect x="35" y="2"  width="20" height="108" rx="3" fill="currentColor" />
            <rect x="64" y="18" width="20" height="92"  rx="3" fill="currentColor" />
          </svg>
          <h2 className="relative tt-title text-2xl font-bold tracking-tight mb-3">your shelf is empty.</h2>
          <p className="relative text-sm text-muted max-w-sm leading-relaxed mb-6">
            add a source to start filling it up. blogs, youtube channels, x accounts, newsletters — pick what you actually read.
          </p>
          <Link
            to="/sources"
            className="relative bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 transition-colors"
          >
            add your first source →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div {...pull.handlers}>
      <PullSpinner pull={pull} />
      {showPushBanner && (
        <div className="push-banner-fade-in mb-8 bg-elev border-t border-b border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-ink flex-1">want a quiet ping when something new shows up?</p>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={acceptPushBanner}
              disabled={pushBusy}
              className="text-sm text-wood font-bold hover:underline disabled:opacity-50"
            >
              {pushBusy ? '…' : 'yes, turn on'}
            </button>
            <button
              type="button"
              onClick={declinePushBanner}
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              not now
            </button>
          </div>
        </div>
      )}

      {showIosInstallBanner && (
        <div className="push-banner-fade-in mb-8 bg-elev border-t border-b border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-ink flex-1">
            install tsundoku to your home screen to enable push on iphone. tap share → add to home screen.
          </p>
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={declinePushBanner}
              className="text-sm text-wood font-bold hover:underline"
            >
              got it
            </button>
          </div>
        </div>
      )}

      <section className="mb-8 sm:mb-10">
        <h2 className="eyebrow text-muted mb-3 pb-2 border-b border-border">New Reads / Watches</h2>
        {/* Swiss collapses the tag borders; Wood/Bohemian space them into pills.
            overflow-hidden contains the 1px collapse offset so it can never
            cause sideways scroll on narrow phones. */}
        <div className="tag-row flex flex-wrap -mt-px overflow-hidden">
          {visibleTypes.map(t => {
            const count = countByType[t] || 0;
            return (
              <Link
                key={t}
                to={`/t/${t}`}
                className="tag group shrink-0 inline-flex items-center gap-2 border border-line -ml-px -mt-px px-3 py-2 text-xs font-bold tt-label tracking-eyebrow hover:bg-ink hover:text-bg transition-colors"
              >
                <span>{typeLabel(t)}</span>
                <span className={count > 0 ? 'text-wood group-hover:text-bg tabular-nums' : 'text-muted group-hover:text-bg tabular-nums'}>
                  {String(count).padStart(2, '0')}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Domain grid. Swiss: collapsed modular hairlines (container top/left +
          cell right/bottom). Wood/Bohemian override to gapped rounded cards. */}
      <div className="domain-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-line">
        {domains.map(d => (
          <Link
            key={d.id}
            to={`/d/${d.slug}`}
            className="domain-cell group relative min-w-0 bg-bg border-r border-b border-line aspect-square p-4 hover:bg-ink hover:text-bg transition-colors flex flex-col overflow-hidden"
          >
            <div className="text-wood group-hover:text-bg transition-colors">
              <DomainIcon name={d.icon} className="w-6 h-6" />
            </div>
            <div className="flex-1" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate tt-title">{d.name}</h2>
              <div className="text-xs text-muted group-hover:text-bg/70 mt-1 min-h-[1.1em] tabular-nums">
                {d.unread_count > 0 ? `${d.unread_count} new` : ''}
              </div>
            </div>
            {d.unread_count > 0 && (
              <span className="domain-badge absolute top-0 right-0 text-[10px] font-bold text-bg bg-wood px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums">
                {d.unread_count}
              </span>
            )}
          </Link>
        ))}

        {/* Trailing "+" tile — create another domain. */}
        <button
          onClick={() => setModalOpen(true)}
          aria-label="New domain"
          className="domain-cell group min-w-0 bg-bg border-r border-b border-line aspect-square p-4 hover:bg-ink hover:text-bg transition-colors flex flex-col items-center justify-center text-muted"
        >
          <PlusIcon className="w-6 h-6 group-hover:text-bg" />
          <span className="mt-2 text-xs font-bold tt-label tracking-eyebrow group-hover:text-bg">new domain</span>
        </button>
      </div>

      {modalOpen && (
        <DomainModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />
      )}
    </div>
  );
}

// Small wood-coloured pull-to-refresh indicator shown at the top of the feed.
function PullSpinner({ pull }) {
  if (!pull.isRefreshing && pull.pullDistance <= 0) return null;
  const height = pull.isRefreshing ? 36 : pull.pullDistance;
  const opacity = pull.isRefreshing ? 1 : Math.min(1, pull.pullDistance / 80);
  return (
    <div className="flex items-center justify-center overflow-hidden" style={{ height }}>
      <span
        className="inline-block w-5 h-5 rounded-full border-2 border-wood border-t-transparent animate-spin"
        style={{ opacity }}
      />
    </div>
  );
}
