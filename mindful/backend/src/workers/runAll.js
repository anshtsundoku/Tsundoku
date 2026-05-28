import 'dotenv/config';
import cron from 'node-cron';
import { runRssOnce } from './rssWorker.js';
import { runTwitterOnce } from './twitterWorker.js';
import { runYoutubeOnce } from './youtubeWorker.js';
import { runEmailListener } from './emailWorker.js';

const RSS_INTERVAL = Number(process.env.RSS_POLL_INTERVAL || 300);
const TWITTER_INTERVAL = Number(process.env.TWITTER_POLL_INTERVAL || 180);
const YOUTUBE_INTERVAL = Number(process.env.YOUTUBE_POLL_INTERVAL || 900);

// Helper that converts seconds into a cron expression. Floor to a reasonable cadence.
function everySeconds(seconds) {
  if (seconds < 60) return `*/${Math.max(10, seconds)} * * * * *`;     // sub-minute
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

function schedule(name, fn, seconds) {
  // Run immediately on boot so we don't wait for the first tick.
  fn().catch(e => console.warn(`[${name}] initial run failed`, e.message));
  cron.schedule(everySeconds(seconds), () => {
    fn().catch(e => console.warn(`[${name}] tick failed`, e.message));
  });
  console.log(`[workers] scheduled ${name} every ${seconds}s`);
}

schedule('rss',     runRssOnce,     RSS_INTERVAL);
schedule('twitter', runTwitterOnce, TWITTER_INTERVAL);
schedule('youtube', runYoutubeOnce, YOUTUBE_INTERVAL);

// Email runs as a persistent IMAP IDLE listener, not on a poll.
runEmailListener().catch(e => console.warn('[email] listener crashed', e.message));

console.log('[workers] all started');
