/**
 * A live score for a real league, without signing in.
 *
 * The league's own live service refuses anonymous callers, and so does every
 * lineup endpoint — a manager's eleven is private until the league calculates
 * the matchweek. Two public things are nonetheless enough to rebuild the score:
 * the squads, which `fetchRoster` recovers from the statistics service, and the
 * Serie A feed, which carries every rating and bonus as they happen.
 *
 * What is reconstructed here is therefore an estimate, and it is labelled as
 * one. It fields each squad the way the app fields an unset lineup — ranked by
 * the feed's probable-lineup percentage, never by the rating a player ended up
 * with — then applies the league's substitution and modifier rules. For a
 * manager who left their lineup to the site's own auto-fill it lands on the real
 * eleven; for one who picked a side by hand it is a good guess at it.
 */

import { autoLineup } from "./league";
import { DEFAULT_RULES, type Ruleset } from "./rules";
import {
  fetchAllRosters,
  type PublicLeague,
  type PublicRosterPlayer,
} from "./public-league";
import { goalsFor, scoreTeam, type ScoredPlayer } from "./scoring";
import type { LiveSnapshot, Role } from "./types";

export interface EstimatedPlayer {
  id: number;
  name: string;
  club: string;
  /** Serie A club id, for the crest. */
  clubId: number;
  role: Role;
  /** Rating plus bonus, or null while the player has no vote. */
  fantavoto: number | null;
  grade: number | null;
  bonus: number;
  hasVote: boolean;
  startProbability: number;
  /** Name of the starter this player came on for, when the engine subbed. */
  cameOnFor: string | null;
  /** True when the slot scores nothing: no vote and no replacement left. */
  void: boolean;
}

export interface EstimatedTeam {
  teamId: number;
  name: string;
  logo: string | null;
  manager: string;
  formation: string;
  fantapoints: number;
  goals: number;
  defenseModifier: number;
  substitutionsUsed: number;
  /** How many of the eleven slots already have a settled rating. */
  ratedSlots: number;
  /** Fantapunti still needed for one more goal. */
  pointsToNextGoal: number;
  players: EstimatedPlayer[];
  /** Bench players the engine did not need. */
  bench: EstimatedPlayer[];
}

export interface LiveEstimate {
  /** League matchweek the estimate covers. */
  matchweek: number;
  /** Serie A matchweek it is played on. */
  serieAMatchweek: number;
  /** True while at least one Serie A match is being played. */
  live: boolean;
  /** True once every Serie A match has finished. */
  complete: boolean;
  /** Ordered by fantapoints, best first. */
  teams: EstimatedTeam[];
  /** Teams whose squad could not be read. */
  missing: number[];
}

/**
 * Rosters change only when the market moves, so they outlive a matchweek. The
 * feed is polled every few seconds during matches and each poll would otherwise
 * drag a request per team along with it.
 */
const ROSTER_TTL = 10 * 60 * 1000;

const rosterCache = new Map<
  string,
  { rosters: Map<number, PublicRosterPlayer[]>; at: number }
>();

async function rostersOf(
  league: PublicLeague,
): Promise<Map<number, PublicRosterPlayer[]>> {
  const hit = rosterCache.get(league.alias);
  if (hit && Date.now() - hit.at < ROSTER_TTL) return hit.rosters;

  const rosters = await fetchAllRosters(league);
  // An empty result is a failed read, not a league without squads: keep the
  // last good one rather than reporting every team as unreadable.
  if (rosters.size === 0 && hit) return hit.rosters;

  rosterCache.set(league.alias, { rosters, at: Date.now() });
  return rosters;
}

function describe(
  scored: ScoredPlayer,
  roster: Map<number, PublicRosterPlayer>,
  extra: Partial<EstimatedPlayer> = {},
): EstimatedPlayer {
  const owned = roster.get(scored.player.id);
  return {
    id: scored.player.id,
    name: scored.player.name || owned?.name || "",
    club: scored.player.teamName || owned?.club || "",
    clubId: scored.player.teamId,
    role: scored.player.role,
    fantavoto: scored.fantavoto,
    grade: scored.grade,
    bonus: scored.bonus,
    hasVote: scored.hasVote,
    startProbability: scored.player.startProbability,
    cameOnFor: null,
    void: false,
    ...extra,
  };
}

/**
 * Scores every squad in the league against a matchweek's Serie A feed.
 *
 * `snapshot` must be the matchweek the league is currently playing; the caller
 * maps league matchweeks onto Serie A ones, since a competition need not start
 * at matchweek 1.
 */
export async function estimateLive(
  league: PublicLeague,
  snapshot: LiveSnapshot,
  matchweek: number,
  rules: Ruleset = DEFAULT_RULES,
): Promise<LiveEstimate> {
  const rosters = await rostersOf(league);

  const teams: EstimatedTeam[] = [];
  const missing: number[] = [];

  for (const team of league.teams) {
    const roster = rosters.get(team.id);
    if (!roster?.length) {
      missing.push(team.id);
      continue;
    }

    const owned = new Map(roster.map((p) => [p.id, p]));
    // Season form breaks ties among players equally likely to start — which,
    // after kickoff, means it decides the order among those who did. Both
    // figures are known before the matchweek, so this stays free of hindsight.
    const lineup = autoLineup(
      roster.map((p) => p.id),
      snapshot,
      rules,
      new Map(roster.map((p) => [p.id, p.averageFantaGrade])),
    );
    const score = scoreTeam(lineup, snapshot, rules);

    const players = score.slots.map((slot) =>
      describe(slot.counted, owned, {
        cameOnFor: slot.substitute ? slot.starter.player.name : null,
        void: slot.void,
      }),
    );

    teams.push({
      teamId: team.id,
      name: team.name,
      logo: team.logo,
      manager: team.manager,
      formation: lineup.formation,
      fantapoints: score.total,
      goals: goalsFor(score.total, rules),
      defenseModifier: score.defenseModifier,
      substitutionsUsed: score.substitutionsUsed,
      ratedSlots: score.ratedSlots,
      pointsToNextGoal: score.pointsToNextGoal,
      players,
      bench: score.unusedBench.map((p) => describe(p, owned)),
    });
  }

  teams.sort((a, b) => b.fantapoints - a.fantapoints || a.name.localeCompare(b.name));

  return {
    matchweek,
    serieAMatchweek: snapshot.matchweek,
    live: snapshot.matches.some((m) => m.state === "live"),
    complete:
      snapshot.matches.length > 0 &&
      snapshot.matches.every(
        (m) => m.state === "finished" || m.state === "postponed",
      ),
    teams,
    missing,
  };
}

/** Maps a league matchweek onto the Serie A matchweek it is played on. */
export function serieAMatchweekFor(
  league: PublicLeague,
  matchweek: number,
): number {
  return league.serieAStart + matchweek - league.firstMatchweek;
}
