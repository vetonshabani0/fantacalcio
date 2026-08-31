import { DEFAULT_RULES, parseFormation, type Ruleset } from "./rules";
import { goalsFor, scoreTeam, type Lineup, type TeamScore } from "./scoring";
import type { LivePlayer, LiveSnapshot, Role } from "./types";

export interface Team {
  id: string;
  /** Fantasy team name. */
  name: string;
  /** The person running it — what a user types to find themselves. */
  manager: string;
  /** Player ids from the Serie A feed. */
  roster: number[];
}

export interface Fixture {
  matchweek: number;
  homeTeamId: string;
  awayTeamId: string;
}

export interface League {
  code: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  seasonId: number;
  /** Real Serie A matchweek that this league's matchweek 1 maps to. */
  startMatchweek: number;
  rules: Ruleset;
  teams: Team[];
  fixtures: Fixture[];
  /** Manually set lineups, keyed `teamId:matchweek`. Missing ones are auto-filled. */
  lineups: Record<string, Lineup>;
}

export function lineupKey(teamId: string, matchweek: number): string {
  return `${teamId}:${matchweek}`;
}

/**
 * Round-robin calendar (circle method). With an odd number of teams one side
 * sits out each week; those byes simply produce no fixture.
 */
export function buildCalendar(teams: Team[], rounds = 2): Fixture[] {
  const ids: (string | null)[] = teams.map((t) => t.id);
  if (ids.length % 2 === 1) ids.push(null);

  const n = ids.length;
  const half = n / 2;
  const fixtures: Fixture[] = [];
  let order = [...ids];
  let matchweek = 1;

  for (let round = 0; round < rounds; round++) {
    // Restart the rotation each round so the second leg mirrors the first.
    order = [...ids];
    for (let week = 0; week < n - 1; week++) {
      for (let i = 0; i < half; i++) {
        const a = order[i];
        const b = order[n - 1 - i];
        if (!a || !b) continue;
        // Alternate home advantage per week and per round.
        const flip = (week + round) % 2 === 1;
        fixtures.push({
          matchweek,
          homeTeamId: flip ? b : a,
          awayTeamId: flip ? a : b,
        });
      }
      matchweek++;
      const fixed = order[0];
      const rest = order.slice(1);
      rest.unshift(rest.pop()!);
      order = [fixed, ...rest];
    }
  }
  return fixtures;
}

/**
 * Picks a starting eleven from a roster, the way a manager would before kickoff.
 *
 * Ranking deliberately uses only the feed's probable-lineup percentage and never
 * the rating a player ended up with. Picking by rating would be hindsight: it
 * would always field players who turned out to play, and the bench would never
 * be needed. Ranking by expectation instead means a starter who does not play
 * genuinely goes unrated, and the substitution engine has to cover for him.
 */
export function autoLineup(
  roster: number[],
  snapshot: LiveSnapshot,
  rules: Ruleset = DEFAULT_RULES,
): Lineup {
  const players = roster
    .map((id) => snapshot.byId[id])
    .filter((p): p is LivePlayer => p != null);

  const rank = (p: LivePlayer): number =>
    p.startProbability * 100 - p.lineupPosition;

  const byRole: Record<Role, LivePlayer[]> = { P: [], D: [], C: [], A: [] };
  for (const p of players) byRole[p.role].push(p);
  for (const role of Object.keys(byRole) as Role[]) {
    byRole[role].sort((a, b) => rank(b) - rank(a));
  }

  // Choose the formation whose shape this roster can best fill.
  let best = { formation: rules.formations[0], score: -Infinity };
  for (const formation of rules.formations) {
    const need = parseFormation(formation);
    let score = 0;
    let feasible = true;
    for (const role of ["P", "D", "C", "A"] as Role[]) {
      const pool = byRole[role];
      if (pool.length < need[role]) {
        feasible = false;
        break;
      }
      score += pool.slice(0, need[role]).reduce((s, p) => s + rank(p), 0);
    }
    if (feasible && score > best.score) best = { formation, score };
  }

  const need = parseFormation(best.formation);
  const starters: number[] = [];
  const used = new Set<number>();
  for (const role of ["P", "D", "C", "A"] as Role[]) {
    for (const p of byRole[role].slice(0, need[role])) {
      starters.push(p.id);
      used.add(p.id);
    }
  }

  const bench = players
    .filter((p) => !used.has(p.id))
    .sort((a, b) => rank(b) - rank(a))
    .map((p) => p.id);

  return { formation: best.formation, starters, bench };
}

export function lineupFor(
  league: League,
  team: Team,
  matchweek: number,
  snapshot: LiveSnapshot,
): { lineup: Lineup; auto: boolean } {
  const saved = league.lineups[lineupKey(team.id, matchweek)];
  if (saved) return { lineup: saved, auto: false };
  return { lineup: autoLineup(team.roster, snapshot, league.rules), auto: true };
}

export interface HeadToHead {
  matchweek: number;
  home: { team: Team; score: TeamScore; lineupIsAuto: boolean };
  away: { team: Team; score: TeamScore; lineupIsAuto: boolean };
  /** Fantasy goals, after threshold conversion. */
  result: { homeGoals: number; awayGoals: number };
  /** 3/1/0 for the home and away sides. */
  points: { home: number; away: number };
  settled: boolean;
}

export function computeHeadToHead(
  league: League,
  fixture: Fixture,
  snapshot: LiveSnapshot,
): HeadToHead | null {
  const home = league.teams.find((t) => t.id === fixture.homeTeamId);
  const away = league.teams.find((t) => t.id === fixture.awayTeamId);
  if (!home || !away) return null;

  const side = (team: Team) => {
    const { lineup, auto } = lineupFor(league, team, fixture.matchweek, snapshot);
    return {
      team,
      score: scoreTeam(lineup, snapshot, league.rules),
      lineupIsAuto: auto,
    };
  };

  const h = side(home);
  const a = side(away);
  const homeGoals = goalsFor(h.score.total, league.rules);
  const awayGoals = goalsFor(a.score.total, league.rules);

  const points =
    homeGoals === awayGoals
      ? { home: 1, away: 1 }
      : homeGoals > awayGoals
        ? { home: 3, away: 0 }
        : { home: 0, away: 3 };

  const settled = snapshot.matches.every(
    (m) => m.state === "finished" || m.state === "postponed",
  );

  return {
    matchweek: fixture.matchweek,
    home: h,
    away: a,
    result: { homeGoals, awayGoals },
    points,
    settled,
  };
}

export interface StandingRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Total fantapunti, the conventional tiebreaker. */
  fantapunti: number;
  position: number;
  /** Movement vs. the standings before the current matchweek. */
  trend: "up" | "down" | "same" | "new";
}

/**
 * Builds the table from every matchweek up to and including `throughMatchweek`.
 * Needs one snapshot per league matchweek, keyed by league matchweek number.
 */
export function computeStandings(
  league: League,
  snapshots: Map<number, LiveSnapshot>,
  throughMatchweek: number,
): StandingRow[] {
  const build = (limit: number): Map<string, Omit<StandingRow, "position" | "trend">> => {
    const table = new Map<string, Omit<StandingRow, "position" | "trend">>();
    for (const team of league.teams) {
      table.set(team.id, {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        fantapunti: 0,
      });
    }

    for (const fixture of league.fixtures) {
      if (fixture.matchweek > limit) continue;
      const snapshot = snapshots.get(fixture.matchweek);
      if (!snapshot) continue;
      const h2h = computeHeadToHead(league, fixture, snapshot);
      if (!h2h) continue;

      const home = table.get(fixture.homeTeamId);
      const away = table.get(fixture.awayTeamId);
      if (!home || !away) continue;

      home.played++;
      away.played++;
      home.goalsFor += h2h.result.homeGoals;
      home.goalsAgainst += h2h.result.awayGoals;
      away.goalsFor += h2h.result.awayGoals;
      away.goalsAgainst += h2h.result.homeGoals;
      home.fantapunti += h2h.home.score.total;
      away.fantapunti += h2h.away.score.total;
      home.points += h2h.points.home;
      away.points += h2h.points.away;

      if (h2h.points.home === 3) {
        home.won++;
        away.lost++;
      } else if (h2h.points.away === 3) {
        away.won++;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
      }
    }

    for (const row of table.values()) {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      row.fantapunti = Math.round(row.fantapunti * 100) / 100;
    }
    return table;
  };

  const order = (
    table: Map<string, Omit<StandingRow, "position" | "trend">>,
  ) =>
    [...table.values()].sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        b.fantapunti - a.fantapunti ||
        a.team.name.localeCompare(b.team.name),
    );

  const current = order(build(throughMatchweek));
  const previousOrder = order(build(Math.max(0, throughMatchweek - 1)));
  const previousPosition = new Map(
    previousOrder.map((row, i) => [row.team.id, i + 1]),
  );

  return current.map((row, i) => {
    const position = i + 1;
    const before = previousPosition.get(row.team.id);
    const trend: StandingRow["trend"] =
      throughMatchweek <= 1 || before == null
        ? "new"
        : before === position
          ? "same"
          : before > position
            ? "up"
            : "down";
    return { ...row, position, trend };
  });
}

/** Fixtures for one league matchweek. */
export function fixturesOf(league: League, matchweek: number): Fixture[] {
  return league.fixtures.filter((f) => f.matchweek === matchweek);
}

/** Maps a league matchweek onto the real Serie A matchweek it is played on. */
export function realMatchweekFor(league: League, matchweek: number): number {
  return league.startMatchweek + matchweek - 1;
}

export function leagueMatchweekFor(league: League, realMatchweek: number): number {
  return realMatchweek - league.startMatchweek + 1;
}

export function maxMatchweek(league: League): number {
  return league.fixtures.reduce((m, f) => Math.max(m, f.matchweek), 0);
}
