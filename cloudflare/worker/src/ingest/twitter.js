// Twitter ingestion inside a Worker, per user.
//
// We call x.com's web GraphQL endpoints directly using each user's own session
// cookies (auth_token + ct0), decrypted from the credential vault. A user is
// only polled if BOTH twitter_auth_token_enc and twitter_ct0_enc are set.

import { all, first } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { upsertPost } from './_common.js';
import { decryptOrNull } from '../lib/userCreds.js';
import { selectUserBatch, yieldTick } from '../lib/cronFanout.js';

// Twitter web bearer is a well-known public constant used by the web client.
const BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// GraphQL query IDs change occasionally. UserByScreenName + UserTweets are
// the two we need.
const QUERY_USER_BY_SCREEN_NAME = 'sLVLhk0bGj3MVFEKTdax1w';
const QUERY_USER_TWEETS         = 'V7H0Ap3_Hh2FyS75OCDO3Q';

// `tw` is the per-user context: { authToken, ct0, kdt?, guestId? }.
function buildCookie(tw) {
  return [
    tw.kdt     && `kdt=${tw.kdt}`,
    tw.guestId && `guest_id=${tw.guestId}`,
    `auth_token=${tw.authToken}`,
    `ct0=${tw.ct0}`,
  ].filter(Boolean).join('; ');
}

function commonHeaders(tw) {
  return {
    'authorization': `Bearer ${BEARER}`,
    'x-csrf-token':  tw.ct0,
    'cookie':        buildCookie(tw),
    'content-type':  'application/json',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    'user-agent':    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  };
}

async function userByScreenName(tw, handle) {
  const variables = JSON.stringify({ screen_name: handle, withSafetyModeUserFields: true });
  const features  = JSON.stringify({
    hidden_profile_likes_enabled: true, hidden_profile_subscriptions_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });
  const url = `https://x.com/i/api/graphql/${QUERY_USER_BY_SCREEN_NAME}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;
  const r = await fetch(url, { headers: commonHeaders(tw) });
  if (!r.ok) throw new Error(`UserByScreenName ${r.status}`);
  const data = await r.json();
  return data?.data?.user?.result?.rest_id || null;
}

async function userTweets(tw, userId, count = 10) {
  const variables = JSON.stringify({
    userId, count,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: false,
    withVoice: true, withV2Timeline: true,
  });
  const features = JSON.stringify({
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  });
  const url = `https://x.com/i/api/graphql/${QUERY_USER_TWEETS}/UserTweets?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;
  const r = await fetch(url, { headers: commonHeaders(tw) });
  if (!r.ok) throw new Error(`UserTweets ${r.status}`);
  const data = await r.json();
  const entries = data?.data?.user?.result?.timeline_v2?.timeline?.instructions
    ?.flatMap(i => i.entries || []) || [];
  const tweets = [];
  for (const e of entries) {
    const t = e?.content?.itemContent?.tweet_results?.result;
    const legacy = t?.legacy;
    if (!legacy) continue;
    const media = legacy.entities?.media?.[0];
    tweets.push({
      id: legacy.id_str,
      created_at: legacy.created_at,
      full_text: legacy.full_text,
      image_url: media?.media_url_https || null,
      video_url: media?.type === 'video' ? media?.video_info?.variants?.[0]?.url : null,
    });
  }
  return tweets;
}

export async function runTwitter(env) {
  // Only users who have BOTH session cookies stored.
  const rows = await all(env, `
    SELECT id FROM users
     WHERE twitter_auth_token_enc IS NOT NULL AND twitter_ct0_enc IS NOT NULL`);
  const batch = await selectUserBatch(env, rows.map(r => r.id), 'twitter');
  for (const uid of batch) {
    try {
      await runTwitterForUser(env, uid);
    } catch (e) {
      console.warn('[twitter] user', uid, 'failed:', e.message);
    }
    await yieldTick();
  }
}

async function runTwitterForUser(env, userId) {
  const u = await first(env, `
    SELECT gemini_api_key_enc, twitter_auth_token_enc, twitter_ct0_enc
      FROM users WHERE id = ?`, [userId]);
  const authToken = await decryptOrNull(env, u?.twitter_auth_token_enc);
  const ct0       = await decryptOrNull(env, u?.twitter_ct0_enc);
  if (!authToken || !ct0) return;   // can't poll without both cookies

  const geminiApiKey = await decryptOrNull(env, u?.gemini_api_key_enc);
  // KDT / GUEST_ID remain optional shared extras from env, if present.
  const tw = { authToken, ct0, kdt: env.TWITTER_KDT, guestId: env.TWITTER_GUEST_ID };

  const sources = await all(env,
    `SELECT * FROM sources WHERE user_id = ? AND type = 'twitter' AND active = 1`, [userId]);
  // Process at most N per tick (oldest-polled first) to stay polite.
  const max = Number(env.TWITTER_POLL_HANDLES_PER_TICK || 5);
  sources.sort((a, b) => (a.last_polled_at || '').localeCompare(b.last_polled_at || ''));
  const handleBatch = sources.slice(0, max);

  for (const s of handleBatch) {
    try {
      const uid = await userByScreenName(tw, s.identifier);
      if (!uid) { console.warn('[twitter] user not found', s.identifier); continue; }
      const tweets = await userTweets(tw, uid, 10);
      for (const t of tweets) {
        const { tldr, read_time_min } = await summarize({
          text: t.full_text || '', kind: 'tweet', geminiApiKey,
        });
        await upsertPost(env, {
          source_id:   s.id,
          external_id: t.id,
          title:       null,
          author:      `@${s.identifier}`,
          url:         `https://x.com/${s.identifier}/status/${t.id}`,
          content_text: t.full_text || '',
          image_url:   t.image_url,
          video_url:   t.video_url,
          tldr,
          read_time_min,
          published_at: t.created_at ? new Date(t.created_at).toISOString() : null,
        });
      }
      console.log(`[twitter] u${userId} @${s.identifier} ok (${tweets.length})`);
      await new Promise(r => setTimeout(r, 800));   // friendly pacing
    } catch (e) {
      console.warn(`[twitter] @${s.identifier} failed:`, e.message);
    }
  }
}
