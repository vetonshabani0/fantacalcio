import type { LiveEvent, MatchState, RealMatch, Role } from "./fanta/types";

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
