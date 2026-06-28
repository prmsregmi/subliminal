// When-to-post scheduler — the "smart algorithm" that lays drafted opportunities
// out across a calendar so a human employee can post them WITHOUT tripping a
// subreddit's mod radar. Pure + deterministic (takes `now`, no Date.now / random
// inside), so the same queue always produces the same schedule.
//
// The three rules that keep it under the radar:
//   1. Daily cap        — never post more than MAX_POSTS_PER_DAY across the whole
//                          campaign, so activity never looks like a coordinated burst.
//   2. Per-sub cooldown — at least SUB_COOLDOWN_DAYS between two posts in the SAME
//                          subreddit, the single biggest "are you astroturfing?" tell.
//   3. Peak windows     — only schedule inside PEAK_HOURS, when threads actually get
//                          seen, with index-based jitter so it never looks metronomic.
// Higher-scoring opportunities get the earliest slots.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export const MAX_POSTS_PER_DAY = 4;
export const SUB_COOLDOWN_DAYS = 3;
// Local-time hours when Reddit engagement is high (morning commute, lunch, evening).
export const PEAK_HOURS = [8, 12, 19];

export interface SchedulableItem {
  id: string;
  subreddit: string;
  score: number;
}

export interface ScheduledItem {
  id: string;
  scheduledFor: number; // ms epoch
  reason: string;
}

// Candidate posting slots in chronological order: PEAK_HOURS each day, starting
// today (only future slots), with a few minutes of deterministic jitter.
function* slots(now: number): Generator<number> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let day = start.getTime();
  let n = 0;
  // Bounded so a pathological queue can't loop forever (~1 year of slots).
  for (let d = 0; d < 365; d++) {
    for (const hour of PEAK_HOURS) {
      const jitter = ((n * 17 + 11) % 23) * MIN_MS; // 0–22 min, deterministic
      const slot = day + hour * HOUR_MS + jitter;
      n++;
      if (slot > now) yield slot;
    }
    day += DAY_MS;
  }
}

// Assign each item the earliest slot that respects the daily cap and the
// per-subreddit cooldown. Best (highest-score) items are placed first.
export function computeSchedule(
  items: SchedulableItem[],
  now: number,
): Map<string, ScheduledItem> {
  const ordered = [...items].sort((a, b) => b.score - a.score);
  const lastBySub = new Map<string, number>();
  const perDay = new Map<number, number>();
  const out = new Map<string, ScheduledItem>();

  const dayKey = (t: number) => Math.floor(t / DAY_MS);

  for (const item of ordered) {
    const sub = item.subreddit.toLowerCase();
    let placed: number | null = null;
    for (const slot of slots(now)) {
      // Skip slots already filled by an earlier, higher-priority item.
      const used = [...out.values()].some((s) => s.scheduledFor === slot);
      if (used) continue;
      if ((perDay.get(dayKey(slot)) ?? 0) >= MAX_POSTS_PER_DAY) continue;
      const last = lastBySub.get(sub);
      if (last !== undefined && slot - last < SUB_COOLDOWN_DAYS * DAY_MS) continue;
      placed = slot;
      break;
    }
    if (placed === null) continue; // no slot inside the horizon
    lastBySub.set(sub, placed);
    perDay.set(dayKey(placed), (perDay.get(dayKey(placed)) ?? 0) + 1);
    out.set(item.id, {
      id: item.id,
      scheduledFor: placed,
      reason: `r/${item.subreddit}: peak window, ≥${SUB_COOLDOWN_DAYS}d after the last post here, ≤${MAX_POSTS_PER_DAY}/day campaign-wide`,
    });
  }
  return out;
}
