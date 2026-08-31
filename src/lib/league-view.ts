import {
  computeHeadToHead,
  computeStandings,
  fixturesOf,
  lineupFor,
  maxMatchweek,
  realMatchweekFor,
  leagueMatchweekFor,
  type HeadToHead,
  type League,
  type StandingRow,
  type Team,
} from "./fanta/league";
import { EVENT_LABEL } from "./fanta/rules";
import type { ScoredPlayer, SlotResult, TeamScore } from "./fanta/scoring";
import { getSnapshot, resolvePointer } from "./fanta/source";
import type { LiveSnapshot } from "./fanta/types";

/** Everything a league page renders, computed server-side in one pass. */
export interface LeagueView {
  league: {
    code: string;
    name: string;
    teamCount: number;
    startMatchweek: number;
    firstGoalThreshold: number;
    goalStep: number;
  };
  matchweek: number;
  realMatchweek: number;
  totalMatchweeks: number;
  live: boolean;
  fetchedAt: number;
  matchesSettled: boolean;
  standings: SerializedStanding[];
  fixtures: SerializedHeadToHead[];
  teams: { id: string; name: string; manager: string }[];
}

export interface SerializedStanding {
  teamId: string;
  teamName: string;
  manager: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fantapunti: number;
  trend: StandingRow["trend"];
  /** Points this team is scoring right now, for the live column. */
  livePoints: number | null;
}

export interface SerializedSlot {
  role: string;
  playerId: number;
  name: string;
  teamName: string;
  grade: number | null;
  bonus: number;
  fantavoto: number | null;
  hasVote: boolean;
  matchState: string;
  breakdown: { label: string; count: number; points: number }[];
  /** Present when the bench engine replaced this slot. */
  substitution: {
    outName: string;
    outReason: string;
    inName: string;
    inFantavoto: number | null;
  } | null;
  void: boolean;
}

export interface SerializedSide {
  teamId: string;
  teamName: string;
  manager: string;
  formation: string;
  lineupIsAuto: boolean;
  total: number;
  baseTotal: number;
  defenseModifier: number;
  defenseAverage: number | null;
  goals: number;
  pointsToNextGoal: number;
  ratedSlots: number;
  substitutionsUsed: number;
  slots: SerializedSlot[];
  bench: {
    playerId: number;
    name: string;
    role: string;
    teamName: string;
    fantavoto: number | null;
    hasVote: boolean;
  }[];
}

export interface SerializedHeadToHead {
  matchweek: number;
  home: SerializedSide;
  away: SerializedSide;
  homeGoals: number;
  awayGoals: number;
  settled: boolean;
}

function serializeScoredPlayer(scored: ScoredPlayer) {
  return {
    playerId: scored.player.id,
    name: scored.player.name,
    role: scored.player.role,
    teamName: scored.player.teamName,
    fantavoto: scored.fantavoto,
    hasVote: scored.hasVote,
  };
}

function serializeSlot(slot: SlotResult): SerializedSlot {
  const counted = slot.counted;
  return {
    role: slot.role,
    playerId: counted.player.id,
    name: counted.player.name,
    teamName: counted.player.teamName,
    grade: counted.grade,
    bonus: counted.bonus,
    fantavoto: counted.fantavoto,
    hasVote: counted.hasVote,
    matchState: counted.player.matchState,
    breakdown: counted.breakdown.map((b) => ({
      label: EVENT_LABEL[b.kind],
      count: b.count,
      points: b.points,
    })),
    substitution: slot.substitute
      ? {
          outName: slot.starter.player.name,
          outReason:
            slot.starter.player.matchState === "pre-match"
              ? "non ancora in campo"
              : "senza voto",
          inName: slot.substitute.player.name,
          inFantavoto: slot.substitute.fantavoto,
        }
      : null,
    void: slot.void,
  };
}

function serializeSide(
  team: Team,
  score: TeamScore,
  formation: string,
  lineupIsAuto: boolean,
): SerializedSide {
  return {
    teamId: team.id,
    teamName: team.name,
    manager: team.manager,
    formation,
    lineupIsAuto,
    total: score.total,
    baseTotal: score.baseTotal,
    defenseModifier: score.defenseModifier,
    defenseAverage: score.defenseAverage,
    goals: score.goals,
    pointsToNextGoal: score.pointsToNextGoal,
    ratedSlots: score.ratedSlots,
    substitutionsUsed: score.substitutionsUsed,
    slots: score.slots.map(serializeSlot),
    bench: score.unusedBench.map(serializeScoredPlayer),
  };
}

function serializeHeadToHead(
  league: League,
  h2h: HeadToHead,
  snapshot: LiveSnapshot,
): SerializedHeadToHead {
  const formationOf = (team: Team) =>
    lineupFor(league, team, h2h.matchweek, snapshot).lineup.formation;

  return {
    matchweek: h2h.matchweek,
    home: serializeSide(
      h2h.home.team,
      h2h.home.score,
      formationOf(h2h.home.team),
      h2h.home.lineupIsAuto,
    ),
    away: serializeSide(
      h2h.away.team,
      h2h.away.score,
      formationOf(h2h.away.team),
      h2h.away.lineupIsAuto,
    ),
    homeGoals: h2h.result.homeGoals,
    awayGoals: h2h.result.awayGoals,
    settled: h2h.settled,
  };
}

/**
 * Loads every Serie A matchweek this league has reached and derives the table,
 * the current round's head-to-heads and the live scoring column.
 */
export async function buildLeagueView(
  league: League,
  requestedMatchweek?: number,
): Promise<LeagueView | null> {
  const pointer = await resolvePointer();
  const total = maxMatchweek(league);

  const currentFromFeed = Math.min(
    Math.max(1, leagueMatchweekFor(league, pointer.matchweek)),
    total,
  );
  const matchweek = Math.min(
    Math.max(1, requestedMatchweek ?? currentFromFeed),
    total,
  );

  // Fetch every matchweek up to the one being viewed so the table is complete.
  const snapshots = new Map<number, LiveSnapshot>();
  const wanted = Array.from({ length: matchweek }, (_, i) => i + 1);
  await Promise.all(
    wanted.map(async (mw) => {
      const snap = await getSnapshot(
        league.seasonId,
        realMatchweekFor(league, mw),
      );
      if (snap) snapshots.set(mw, snap);
    }),
  );

  const viewed = snapshots.get(matchweek);
  if (!viewed) return null;

  const standings = computeStandings(league, snapshots, matchweek);

  const fixtures = fixturesOf(league, matchweek)
    .map((fixture) => computeHeadToHead(league, fixture, viewed))
    .filter((h): h is HeadToHead => h != null)
    .map((h) => serializeHeadToHead(league, h, viewed));

  const livePointsByTeam = new Map<string, number>();
  for (const fixture of fixtures) {
    livePointsByTeam.set(fixture.home.teamId, fixture.home.total);
    livePointsByTeam.set(fixture.away.teamId, fixture.away.total);
  }

  const matchesSettled = viewed.matches.every(
    (m) => m.state === "finished" || m.state === "postponed",
  );

  return {
    league: {
      code: league.code,
      name: league.name,
      teamCount: league.teams.length,
      startMatchweek: league.startMatchweek,
      firstGoalThreshold: league.rules.firstGoalThreshold,
      goalStep: league.rules.goalStep,
    },
    matchweek,
    realMatchweek: realMatchweekFor(league, matchweek),
    totalMatchweeks: total,
    live: viewed.matches.some((m) => m.state === "live"),
    fetchedAt: viewed.fetchedAt,
    matchesSettled,
    standings: standings.map((row) => ({
      teamId: row.team.id,
      teamName: row.team.name,
      manager: row.team.manager,
      position: row.position,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
      fantapunti: row.fantapunti,
      trend: row.trend,
      livePoints: livePointsByTeam.get(row.team.id) ?? null,
    })),
    fixtures,
    teams: league.teams.map((t) => ({
      id: t.id,
      name: t.name,
      manager: t.manager,
    })),
  };
}
