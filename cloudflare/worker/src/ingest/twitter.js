// Twitter ingestion inside a Worker.
//
// We call x.com's web GraphQL endpoints directly using your session cookies
// (auth_token + ct0). This is the same technique rettiwt-api uses, but
// implemented with plain fetch so it works in the Workers runtime.
//
// Required secrets:
//   TWITTER_AUTH_TOKEN  (cookie: auth_token)
//   TWITTER_CT0         (cookie: ct0; also the CSRF header value)
// Optional:
//   TWITTER_KDT, TWITTER_GUEST_ID
//
// If those secrets aren't set the worker logs a warning and skips.

import { all } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { upsertPost } from './_common.js';

// Twitter web bearer is a well-known public constant used by the web client.
const BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// GraphQL query IDs change occasionally. UserByScreenName + UserTweets are
// the two we need.
const QUERY_USER_BY_SCREEN_NAME = 'sLVLhk0bGj3MVFEKTdax1w';
const QUERY_USER_TWEETS         = 'V7H0Ap3_Hh2FyS75OCDO3Q';

function buildCookie(env) {
  const parts = [
    env.TWITTER_KDT      && `kdt=${env.TWITTER_KDT}`,
    env.TWITTER_GUEST_ID && `guest_id=${env.TWITTER_GUEST_ID}`,
    `auth_token=${env.TWITTER_AUTH_TOKEN}`,
    `ct0=${env.TWITTER_CT0}`,
  ].filter(Boolean).join('; ');
  return parts;
}

function commonHeaders(env) {
  return {
    'authorization': `Bearer ${BEARER}`,
    'x-csrf-token':  env.TWITTER_CT0,
    'cookie':        buildCookie(env),
    'content-type':  'application/json',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    'user-agent':    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  };
}

async function userByScreenName(env, handle) {
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
  const r = await fetch(url, { headers: commonHeaders(env) });
  if (!r.ok) throw new Error(`UserByScreenName ${r.status}`);
  const data = await r.json();
  return data?.data?.user?.result?.rest_id || null;
}

async function userTweets(env, userId, count = 10) {
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
  const r = await fetch(url, { headers: commonHeaders(env) });
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
  if (!env.TWITTER_AUTH_TOKEN || !env.TWITTER_CT0) {
    console.warn('[twitter] TWITTER_AUTH_TOKEN / TWITTER_CT0 not set; skipping');
    return;
  }
  const sources = await all(env, `SELECT * FROM sources WHERE type = 'twitter' AND active = 1`);
  // Process at most N per cron tick to stay polite — handles are picked
  // round-robin by oldest last_polled_at.
  const max = Number(env.TWITTER_POLL_HANDLES_PER_TICK || 5);
  sources.sort((a, b) => (a.last_polled_at || '').localeCompare(b.last_polled_at || ''));
  const batch = sources.slice(0, max);

  for (const s of batch) {
    try {
      const uid = await userByScreenName(env, s.identifier);
      if (!uid) { console.warn('[twitter] user not found', s.identifier); continue; }
      const tweets = await userTweets(env, uid, 10);
      for (const t of tweets) {
        const { tldr, read_time_min } = await summarize(env, { text: t.full_text || '', kind: 'tweet' });
        await upsertPost(env, {
          source_id:   s.id,
          external_id: t.id,
          title:       null,
          author:      `@${s.identifier}`,
          url:         `https://twitter.com/${s.identifier}/status/${t.id}`,
          content_text: t.full_text || '',
          image_url:   t.image_url,
          video_url:   t.video_url,
          tldr,
          read_time_min,
          published_at: t.created_at ? new Date(t.created_at).toISOString() : null,
        });
      }
      console.log(`[twitter] @${s.identifier} ok (${tweets.length})`);
      // Friendly pacing.
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.warn(`[twitter] @${s.identifier} failed:`, e.message);
    }
  }
}
