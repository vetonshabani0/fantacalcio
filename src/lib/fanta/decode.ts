import type {
  EventKind,
  LiveEvent,
  LivePlayer,
  LiveSnapshot,
  MatchState,
  RealMatch,
  Role,
} from "./types";

/** Shape of a player entry in the raw feed. */
interface RawPlayer {
  id: number;
  id_s: number;
  n: string;
  r: Role;
  v: number | null;
  bm: number[];
  min: number[];
  cl?: unknown[];
  cl_t?: unknown[];
  t: number;
  sto: number;
  i: number;
  id_sos: number;
  pp: number;
  sp: number;
}

interface RawMatch {
  id: number;
  id_a: number;
  id_b: number;
  n_a: string;
  n_b: string;
  g_a: number;
  g_b: number;
  m_a: string;
  m_b: string;
  sto: number;
  d: string;
  p_t: string;
  s_t: string;
}

export interface RawFeed {
  success: boolean;
  data: { pl: RawPlayer[]; inc: RawMatch[]; smdid: string } | null;
}

/**
 * The feed's numeric event codes, mapped to the names the official client uses.
 * Derived from the client's `ee` code table combined with its event-name list.
 */
const EVENT_BY_CODE: Record<number, EventKind> = {
  1: "yellowCards",
  2: "redCards",
  3: "scoredGoals",
  4: "concededGoals",
  7: "savedPenalties",
  8: "missedPenalties",
  9: "scoredPenalties",
  10: "ownGoals",
  11: "decisiveGoals",
  12: "equalisingGoals",
  13: "cleanSheets",
  20: "goalContributions",
  21: "softAssists",
  22: "assists",
  23: "goldAssists",
  26: "manOfTheMatch",
  14: "subbedOut",
  15: "subbedIn",
  16: "varDisallowedGoals",
  17: "injuries",
};

/**
 * The feed puts sentinels in the `v` field rather than nulling it: 56 for a
 * player with no vote at all and 55 for one who appeared but was left senza
 * voto. The official client treats any value above 10 as "not a real rating",
 * which covers both without hard-coding them.
 */
const MAX_VALID_GRADE = 10;

export function decodeMatchState(sto: number): MatchState {
  switch (sto) {
    case 0:
    case 666:
      return "pre-match";
    case 1:
    case 2:
    case 3:
      return "live";
    case 4:
      return "finished";
    case 5:
      return "suspended";
    case 6:
      return "postponed";
    default:
      return "pre-match";
  }
}

function decodeMatch(m: RawMatch): RealMatch {
  return {
    id: m.id,
    homeTeamId: m.id_a,
    awayTeamId: m.id_b,
    homeTeamName: m.n_a,
    awayTeamName: m.n_b,
    homeGoals: m.g_a ?? 0,
    awayGoals: m.g_b ?? 0,
    homeFormation: m.m_a ?? "",
    awayFormation: m.m_b ?? "",
    state: decodeMatchState(m.sto),
    kickoff: m.d || null,
    firstHalfStart: m.p_t || null,
    secondHalfStart: m.s_t || null,
  };
}

function decodePlayer(p: RawPlayer, teamName: string): LivePlayer {
  const events: LiveEvent[] = [];
  for (let i = 0; i < p.bm.length; i++) {
    const kind = EVENT_BY_CODE[p.bm[i]];
    if (kind) events.push({ kind, minute: p.min[i] ?? 0 });
  }

  const counts: Partial<Record<EventKind, number>> = {};
  for (const e of events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;

  const hasVote = p.v != null && p.v > 0 && p.v <= MAX_VALID_GRADE;
  const grade = hasVote ? Number(p.v) : null;

  // The official client infers a clean sheet for any rated keeper who conceded nothing.
  if (p.r === "P" && hasVote && !counts.concededGoals && !counts.cleanSheets) {
    counts.cleanSheets = 1;
  }

  return {
    id: p.id,
    name: p.n,
    role: p.r,
    teamId: p.id_s,
    teamName,
    grade,
    events,
    counts,
    onField: p.sp === 1,
    startProbability: p.pp ?? 0,
    lineupPosition: p.i,
    replacedPlayerId: p.id_sos > 0 ? p.id_sos : null,
    matchState: decodeMatchState(p.sto),
  };
}

export function decodeFeed(
  raw: RawFeed,
  seasonId: number,
  matchweek: number,
): LiveSnapshot {
  const data = raw.data ?? { pl: [], inc: [], smdid: "" };
  const matches = (data.inc ?? []).map(decodeMatch);

  // Club id -> display name, taken from whichever side of the fixture it appears on.
  const clubName = new Map<number, string>();
  for (const m of matches) {
    clubName.set(m.homeTeamId, m.homeTeamName);
    clubName.set(m.awayTeamId, m.awayTeamName);
  }

  const players = (data.pl ?? []).map((p) =>
    decodePlayer(p, clubName.get(p.id_s) ?? ""),
  );

  const byId: Record<number, LivePlayer> = {};
  for (const p of players) byId[p.id] = p;

  return {
    seasonId,
    matchweek,
    fetchedAt: Date.now(),
    matches,
    players,
    byId,
  };
}
