import { decodeFeed, type RawFeed } from "./decode";
import type { Club, LivePlayer, LiveSnapshot } from "./types";

/**
 * Leghe Fantacalcio publishes its live matchweek data to an unauthenticated
 * CloudFront bucket, one JSON file per (season, matchweek). This is the exact
 * source their own web client polls during matches, so it is as fresh as the
 * official live scoreboard and needs no credentials.
 */
const BUCKET = "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live";

/** Season 21 is 2026/27. Newer seasons are probed for automatically. */
const KNOWN_SEASON = 21;
const MAX_MATCHWEEK = 38;

function feedUrl(seasonId: number, matchweek: number): string {
  return `${BUCKET}/${seasonId}/live_${matchweek}.json`;
}

async function fetchFeed(
  seasonId: number,
  matchweek: number,
): Promise<LiveSnapshot | null> {
  const res = await fetch(feedUrl(seasonId, matchweek), {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => null);

  // The bucket denies listing, so a missing matchweek surfaces as 403.
  if (!res || !res.ok) return null;

  const raw = (await res.json().catch(() => null)) as RawFeed | null;
  if (!raw?.success) return null;
  return decodeFeed(raw, seasonId, matchweek);
}

async function exists(seasonId: number, matchweek: number): Promise<boolean> {
  const res = await fetch(feedUrl(seasonId, matchweek), {
    method: "HEAD",
    cache: "no-store",
  }).catch(() => null);
  return !!res?.ok;
}

export interface SeasonPointer {
  seasonId: number;
  /** The matchweek currently being played, or the next one due. */
  matchweek: number;
  /** Highest matchweek the bucket has published. */
  latestPublished: number;
  resolvedAt: number;
}

let pointerCache: SeasonPointer | null = null;
let pointerPromise: Promise<SeasonPointer> | null = null;
const POINTER_TTL = 10 * 60 * 1000;

/** Finds the newest published season, in case the bucket rolls over mid-use. */
async function resolveSeason(): Promise<number> {
  let season = KNOWN_SEASON;
  for (let candidate = KNOWN_SEASON + 1; candidate <= KNOWN_SEASON + 3; candidate++) {
    if (await exists(candidate, 1)) season = candidate;
    else break;
  }
  return season;
}

/** Binary search for the highest matchweek the bucket has published. */
async function resolveLatestMatchweek(seasonId: number): Promise<number> {
  let low = 1;
  let high = MAX_MATCHWEEK;
  if (!(await exists(seasonId, 1))) return 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (await exists(seasonId, mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}

export async function resolvePointer(force = false): Promise<SeasonPointer> {
  if (
    !force &&
    pointerCache &&
    Date.now() - pointerCache.resolvedAt < POINTER_TTL
  ) {
    return pointerCache;
  }
  if (pointerPromise) return pointerPromise;

  pointerPromise = (async () => {
    const seasonId = await resolveSeason();
    const latestPublished = await resolveLatestMatchweek(seasonId);

    // The live matchweek is the earliest recent one that is not fully played;
    // once everything has finished we point at the newest published week.
    let matchweek = latestPublished;
    for (
      let mw = Math.max(1, latestPublished - 2);
      mw <= latestPublished;
      mw++
    ) {
      const snap = await fetchFeed(seasonId, mw);
      if (!snap || snap.matches.length === 0) continue;
      const settled = snap.matches.every(
        (m) => m.state === "finished" || m.state === "postponed",
      );
      if (!settled) {
        matchweek = mw;
        break;
      }
    }

    pointerCache = {
      seasonId,
      matchweek,
      latestPublished,
      resolvedAt: Date.now(),
    };
    return pointerCache;
  })().finally(() => {
    pointerPromise = null;
  });

  return pointerPromise;
}

const snapshotCache = new Map<string, { snap: LiveSnapshot; at: number }>();

/**
 * Fetches one matchweek. Finished matchweeks never change, so they are cached
 * for far longer than a matchweek that is still in play.
 */
export async function getSnapshot(
  seasonId: number,
  matchweek: number,
  maxAgeMs = 8000,
): Promise<LiveSnapshot | null> {
  const key = `${seasonId}:${matchweek}`;
  const hit = snapshotCache.get(key);
  if (hit) {
    const settled =
      hit.snap.matches.length > 0 &&
      hit.snap.matches.every(
        (m) => m.state === "finished" || m.state === "postponed",
      );
    const ttl = settled ? 10 * 60 * 1000 : maxAgeMs;
    if (Date.now() - hit.at < ttl) return hit.snap;
  }

  const snap = await fetchFeed(seasonId, matchweek);
  if (snap) snapshotCache.set(key, { snap, at: Date.now() });
  return snap ?? hit?.snap ?? null;
}

export async function getCurrentSnapshot(): Promise<LiveSnapshot | null> {
  const pointer = await resolvePointer();
  return getSnapshot(pointer.seasonId, pointer.matchweek);
}

/** True while at least one Serie A match in the snapshot is being played. */
export function isLiveNow(snapshot: LiveSnapshot | null): boolean {
  return !!snapshot?.matches.some((m) => m.state === "live");
}

/**
 * True when kickoff is close enough that we should poll aggressively even
 * though nothing has started yet.
 */
export function isNearKickoff(snapshot: LiveSnapshot | null): boolean {
  if (!snapshot) return false;
  const now = Date.now();
  return snapshot.matches.some((m) => {
    if (m.state !== "pre-match" || !m.kickoff) return false;
    const t = Date.parse(`${m.kickoff}Z`);
    return Number.isFinite(t) && t - now < 15 * 60 * 1000 && t - now > -60 * 1000;
  });
}

export function clubsOf(snapshot: LiveSnapshot): Club[] {
  const map = new Map<number, string>();
  for (const m of snapshot.matches) {
    map.set(m.homeTeamId, m.homeTeamName);
    map.set(m.awayTeamId, m.awayTeamName);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A searchable player index for building rosters. Squad lists shift week to
 * week, so we merge the current matchweek with the two before it.
 */
export async function getPlayerIndex(): Promise<LivePlayer[]> {
  const pointer = await resolvePointer();
  const weeks = [pointer.matchweek, pointer.matchweek - 1, pointer.matchweek - 2]
    .filter((mw) => mw >= 1);

  const merged = new Map<number, LivePlayer>();
  for (const mw of weeks) {
    const snap = await getSnapshot(pointer.seasonId, mw, 5 * 60 * 1000);
    if (!snap) continue;
    for (const p of snap.players) {
      if (!merged.has(p.id) || p.teamName) merged.set(p.id, p);
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}
