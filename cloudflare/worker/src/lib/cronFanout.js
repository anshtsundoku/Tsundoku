// Per-user cron fan-out helpers.
//
// Each cron handler discovers the set of users with relevant work and processes
// them. While the user count is small (<= THRESHOLD) every tick handles all of
// them. Past that, a single tick only processes CHUNK users, advancing a
// round-robin cursor stored in the `kv` table so that across consecutive ticks
// every user is eventually serviced. This keeps any one tick inside the
// Worker's CPU/subrequest budget.

import { getKv, setKv } from './kv.js';

const THRESHOLD = 20;   // at or below this, process everyone every tick
const CHUNK = 10;       // when above THRESHOLD, users handled per tick

// Given the full set of candidate user ids, return the subset this tick should
// process and advance the round-robin cursor for `cronKey`.
export async function selectUserBatch(env, userIds, cronKey) {
  const ids = [...new Set(userIds)].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (ids.length <= THRESHOLD) return ids;

  const last = Number(await getKv(env, `cron:${cronKey}`));
  let start = ids.findIndex(id => id > last);
  if (start === -1) start = 0;   // wrap to the beginning

  const batch = [];
  for (let i = 0; i < CHUNK && i < ids.length; i++) {
    batch.push(ids[(start + i) % ids.length]);
  }
  await setKv(env, `cron:${cronKey}`, batch[batch.length - 1]);
  return batch;
}

// Cooperative yield between users so a long loop doesn't monopolise the
// event loop turn.
export const yieldTick = () => new Promise(r => setTimeout(r, 0));
