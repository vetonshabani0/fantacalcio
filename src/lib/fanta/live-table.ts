/**
 * The league table as it stands *right now*, mid-matchweek.
 *
 * The public standings stop at the last matchweek the league calculated, which
 * is precisely the wrong moment: what a manager wants while the games are on is
 * where they would finish if the round ended here, and what it would take to
 * move. This folds the in-progress round into the settled table.
 *
 * How exact that is depends on one input. Fantapoints are additive and belong to
 * a team no matter who it faces, so a live fantapoints ranking is always real.
 * Standings *points* are not: 3/1/0 comes from beating a particular opponent, so
 * without the fixtures nobody — including the official site — can say what a
 * round in progress is worth. `exact` reports which of the two this is, and the
 * UI is expected to say so rather than present a guess as a position.
 */

import type { ImportedFixture } from "./calendar-import";
import type { StandingAt } from "./public-league";
import type { EstimatedTeam } from "./public-live";

/** What one team is doing in the round currently being played. */
export interface LiveRound {
  fantapoints: number;
  goals: number;
  /** Points this round is worth, or null when the fixtures are unknown. */
  points: number | null;
  opponent: {
    teamId: number;
    name: string;
    fantapoints: number;
    goals: number;
  } | null;
  /** Fantapoints ahead of (positive) or behind (negative) the opponent. */
  margin: number | null;
  /**
   * Fantapoints still needed to go ahead on goals. Zero when already ahead;
   * null without an opponent to be ahead of.
   */
  toLead: number | null;
  /** Fantapoints still needed for one more goal, opponent or not. */
  toNextGoal: number;
  /** How many of the eleven already have a settled rating. */
  ratedSlots: number;
}

export interface LiveStandingRow {
  teamId: number;
  name: string;
  logo: string | null;
  /** Position as it stands now, with the round folded in. */
  position: number;
  /** Position before the round started. */
  basePosition: number;
  movement: "up" | "down" | "same";
  played: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  /** Season fantapoints including the round in progress. */
  fantapoints: number;
  round: LiveRound | null;
}

export interface LiveTable {
  /** True when fixtures were known and the points are therefore real. */
  exact: boolean;
  matchweek: number;
  rows: LiveStandingRow[];
}

/**
 * Fantapoints needed for `goals` goals, under the league's conversion.
 * The first goal costs `first`, every one after it `step`.
 */
function thresholdFor(goals: number, first: number, step: number): number {
  return goals <= 0 ? 0 : first + (goals - 1) * step;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Folds a round in progress into the settled table.
 *
 * `base` is the table through the last calculated matchweek — real, published
 * figures. `live` is this round's reconstruction. `fixtures` are this round's
 * pairings if a calendar has been imported; without them the round contributes
 * fantapoints and goals but no points, and the ordering falls back to the
 * settled points with live fantapoints as the tiebreak.
 */
export function buildLiveTable(
  base: StandingAt[],
  live: EstimatedTeam[],
  fixtures: ImportedFixture[] | null,
  matchweek: number,
  first = 66,
  step = 6,
): LiveTable {
  const byId = new Map(live.map((t) => [t.teamId, t]));
  const exact = !!fixtures?.length;

  // teamId -> the team it is facing this round.
  const opponentOf = new Map<number, number>();
  for (const f of fixtures ?? []) {
    opponentOf.set(f.homeTeamId, f.awayTeamId);
    opponentOf.set(f.awayTeamId, f.homeTeamId);
  }

  const rows: LiveStandingRow[] = base.map((team) => {
    const mine = byId.get(team.teamId);

    if (!mine) {
      return {
        ...team,
        basePosition: team.position,
        movement: "same" as const,
        round: null,
      };
    }

    const other = byId.get(opponentOf.get(team.teamId) ?? -1) ?? null;

    let points: number | null = null;
    if (other) {
      points = mine.goals === other.goals ? 1 : mine.goals > other.goals ? 3 : 0;
    }

    const round: LiveRound = {
      fantapoints: mine.fantapoints,
      goals: mine.goals,
      points,
      opponent: other
        ? {
            teamId: other.teamId,
            name: other.name,
            fantapoints: other.fantapoints,
            goals: other.goals,
          }
        : null,
      margin: other ? round2(mine.fantapoints - other.fantapoints) : null,
      // To go ahead, outscore what the opponent has now: that needs one more
      // goal than they hold, and the fantapoints its threshold demands.
      toLead: other
        ? mine.goals > other.goals
          ? 0
          : round2(
              Math.max(
                0,
                thresholdFor(other.goals + 1, first, step) - mine.fantapoints,
              ),
            )
        : null,
      toNextGoal: mine.pointsToNextGoal,
      ratedSlots: mine.ratedSlots,
    };

    return {
      teamId: team.teamId,
      name: team.name,
      logo: team.logo,
      position: team.position,
      basePosition: team.position,
      movement: "same" as const,
      played: team.played + (exact ? 1 : 0),
      points: team.points + (points ?? 0),
      won: team.won + (points === 3 ? 1 : 0),
      drawn: team.drawn + (points === 1 ? 1 : 0),
      lost: team.lost + (points === 0 && other ? 1 : 0),
      // Goals only count once they can carry points with them. Adding them
      // while the points stay frozen would order the table on a mix of live
      // and stale figures.
      goalsFor: team.goalsFor + (exact ? mine.goals : 0),
      // Fantapoints are the exception: they are additive and independent of
      // who a team faced, so they are live either way.
      fantapoints: round2(team.fantapoints + mine.fantapoints),
      round,
    };
  });

  // Same ordering the league uses: points, then goals scored, then fantapoints.
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - a.goalsFor ||
      b.fantapoints - a.fantapoints ||
      a.name.localeCompare(b.name),
  );

  rows.forEach((row, i) => {
    row.position = i + 1;
    row.movement =
      row.basePosition === row.position
        ? "same"
        : row.basePosition > row.position
          ? "up"
          : "down";
  });

  return { exact, matchweek, rows };
}
