/**
 * Domain model for the Leghe Fantacalcio public live feed.
 *
 * Source: https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live/{seasonId}/live_{matchweek}.json
 * This is the same unauthenticated bucket the official leghe.fantacalcio.it web app polls
 * during matches. Schema was reverse engineered from their client bundle; see decode.ts.
 */

export type Role = "P" | "D" | "C" | "A";

export const ROLES: Role[] = ["P", "D", "C", "A"];

export const ROLE_LABEL: Record<Role, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

/** Real Serie A match lifecycle, decoded from the feed's `sto` field. */
export type MatchState =
  | "pre-match"
  | "live"
  | "finished"
  | "suspended"
  | "postponed";

/**
 * Canonical event names. The feed ships numeric codes; decode.ts maps them here.
 * Names match the ones the official client uses internally.
 */
export type EventKind =
  | "yellowCards"
  | "redCards"
  | "scoredGoals"
  | "concededGoals"
  | "savedPenalties"
  | "missedPenalties"
  | "scoredPenalties"
  | "ownGoals"
  | "decisiveGoals"
  | "equalisingGoals"
  | "cleanSheets"
  | "goalContributions"
  | "softAssists"
  | "assists"
  | "goldAssists"
  | "manOfTheMatch"
  | "subbedOut"
  | "subbedIn"
  | "varDisallowedGoals"
  | "injuries";

export interface LiveEvent {
  kind: EventKind;
  /** Minute as published. Negative values are used by the feed for stoppage time. */
  minute: number;
}

export interface RealMatch {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  homeFormation: string;
  awayFormation: string;
  state: MatchState;
  kickoff: string | null;
  firstHalfStart: string | null;
  secondHalfStart: string | null;
}

export interface LivePlayer {
  id: number;
  name: string;
  role: Role;
  teamId: number;
  teamName: string;
  /** Raw match rating, or null when the player has no vote yet (SV). */
  grade: number | null;
  events: LiveEvent[];
  /** Counts per event kind, derived from `events`. */
  counts: Partial<Record<EventKind, number>>;
  /** true when the player is on the pitch / was in the starting XI. */
  onField: boolean;
  /** Pre-match probability (percent) that the player starts. */
  startProbability: number;
  /** Shirt position index within the real team's lineup. */
  lineupPosition: number;
  /** When this player came on, the id of the player they replaced. */
  replacedPlayerId: number | null;
  matchState: MatchState;
}

export interface LiveSnapshot {
  seasonId: number;
  matchweek: number;
  /** Server time the snapshot was fetched. */
  fetchedAt: number;
  matches: RealMatch[];
  players: LivePlayer[];
  /** Convenience index: playerId -> player. */
  byId: Record<number, LivePlayer>;
}

/** A single Serie A club, derived from the fixtures in the feed. */
export interface Club {
  id: number;
  name: string;
}
