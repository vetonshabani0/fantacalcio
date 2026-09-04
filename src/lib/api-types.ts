import { scorePlayer } from "./fanta/scoring";
import type { Ruleset } from "./fanta/rules";
import type {
  LiveEvent,
  LivePlayer,
  MatchState,
  RealMatch,
  Role,
} from "./fanta/types";

/** Payload of GET /api/live, shared by the server route and its consumers. */
export interface LiveBoard {
  pointer: {
    seasonId: number;
    matchweek: number;
    latestPublished: number;
    resolvedAt: number;
  };
  live: boolean;
  fetchedAt: number;
  matches: RealMatch[];
  players: BoardPlayer[];
}

export interface BoardPlayer {
  id: number;
  name: string;
  role: Role;
  teamId: number;
  teamName: string;
  grade: number | null;
  bonus: number;
  fantavoto: number | null;
  hasVote: boolean;
  breakdown: { kind: string; count: number; points: number }[];
  events: LiveEvent[];
  onField: boolean;
  startProbability: number;
  replacedPlayerId: number | null;
  matchState: MatchState;
}

/**
 * Turns a scored feed player into the shape the player sheet renders.
 *
 * The sheet is the one place that explains a fantavoto — the rating, every bonus
 * and malus itemised, and the minute each event happened — so anywhere a player
 * can be tapped has to produce this, not just the live board.
 */
export function toBoardPlayer(
  player: LivePlayer,
  rules?: Ruleset,
): BoardPlayer {
  const scored = scorePlayer(player, rules);
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
}
