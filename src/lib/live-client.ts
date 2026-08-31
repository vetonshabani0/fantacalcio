import { decodeFeed, type RawFeed } from "./fanta/decode";
import { scorePlayer } from "./fanta/scoring";
import type { LiveSnapshot } from "./fanta/types";
import type { BoardPlayer, LiveBoard } from "./api-types";

/**
 * Browser-side twin of the server data layer, for the static build.
 *
 * The live bucket answers with `access-control-allow-origin: *`, so a page with
 * no backend at all can read exactly the same feed. Everything downstream —
 * decoding, fantavoto, the bench engine — is pure and already shared with the
 * server, so only the fetching differs.
 */
const BUCKET = "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live";
const KNOWN_SEASON = 21;
const MAX_MATCHWEEK = 38;

function feedUrl(seasonId: number, matchweek: number): string {
  return `${BUCKET}/${seasonId}/live_${matchweek}.json`;
}

async function exists(seasonId: number, matchweek: number): Promise<boolean> {
  const res = await fetch(feedUrl(seasonId, matchweek), {
    method: "HEAD",
    cache: "no-store",
  }).catch(() => null);
  return !!res?.ok;
}

async function fetchSnapshot(
  seasonId: number,
  matchweek: number,
): Promise<LiveSnapshot | null> {
  const res = await fetch(feedUrl(seasonId, matchweek), {
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const raw = (await res.json().catch(() => null)) as RawFeed | null;
  if (!raw?.success) return null;
  return decodeFeed(raw, seasonId, matchweek);
}

interface Pointer {
  seasonId: number;
  matchweek: number;
  latestPublished: number;
}

let pointerCache: { value: Pointer; at: number } | null = null;
const POINTER_TTL = 10 * 60 * 1000;

async function resolvePointer(): Promise<Pointer> {
  if (pointerCache && Date.now() - pointerCache.at < POINTER_TTL) {
    return pointerCache.value;
  }

  let seasonId = KNOWN_SEASON;
  for (let c = KNOWN_SEASON + 1; c <= KNOWN_SEASON + 3; c++) {
    if (await exists(c, 1)) seasonId = c;
    else break;
  }

  // Binary search for the newest published matchweek.
  let low = 1;
  let high = MAX_MATCHWEEK;
  if (await exists(seasonId, 1)) {
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (await exists(seasonId, mid)) low = mid;
      else high = mid - 1;
    }
  }
  const latestPublished = low;

  // The live matchweek is the earliest recent one that is not fully played.
  let matchweek = latestPublished;
  for (let mw = Math.max(1, latestPublished - 2); mw <= latestPublished; mw++) {
    const snap = await fetchSnapshot(seasonId, mw);
    if (!snap || snap.matches.length === 0) continue;
    const settled = snap.matches.every(
      (m) => m.state === "finished" || m.state === "postponed",
    );
    if (!settled) {
      matchweek = mw;
      break;
    }
  }

  const value = { seasonId, matchweek, latestPublished };
  pointerCache = { value, at: Date.now() };
  return value;
}

function toBoardPlayer(snapshot: LiveSnapshot): BoardPlayer[] {
  return snapshot.players.map((player) => {
    const scored = scorePlayer(player);
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      teamId: player.teamId,
      teamName: player.teamName,
      grade: scored.grade,
      bonus: scored.bonus,
      fantavoto: scored.fantavoto,
      hasVote: scored.hasVote,
      breakdown: scored.breakdown,
      events: player.events,
      onField: player.onField,
      startProbability: player.startProbability,
      replacedPlayerId: player.replacedPlayerId,
      matchState: player.matchState,
    };
  });
}

/** Builds the same payload shape the `/api/live` route returns. */
export async function fetchLiveBoard(): Promise<LiveBoard> {
  const pointer = await resolvePointer();
  const snapshot = await fetchSnapshot(pointer.seasonId, pointer.matchweek);
  if (!snapshot) throw new Error("Feed non disponibile");

  return {
    pointer: { ...pointer, resolvedAt: Date.now() },
    live: snapshot.matches.some((m) => m.state === "live"),
    fetchedAt: snapshot.fetchedAt,
    matches: snapshot.matches,
    players: toBoardPlayer(snapshot),
  };
}

/** Poll faster while something is actually being played. */
export function pollInterval(board: LiveBoard | null): number {
  if (!board) return 30_000;
  if (board.live) return 15_000;

  const now = Date.now();
  const soon = board.matches.some((m) => {
    if (m.state !== "pre-match" || !m.kickoff) return false;
    const t = Date.parse(`${m.kickoff}Z`);
    return Number.isFinite(t) && t - now < 15 * 60 * 1000 && t - now > -60_000;
  });
  return soon ? 25_000 : 120_000;
}
