import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import {
  getLeaguePlayers,
  getLeagueTeamsFull,
} from "@/lib/fanta/official";
import {
  fetchPublicLeague,
  fetchRoster,
  type PublicRosterPlayer,
} from "@/lib/fanta/public-league";
import { scorePlayer } from "@/lib/fanta/scoring";
import { getCurrentSnapshot, getPlayerIndex } from "@/lib/fanta/source";
import type { LiveSnapshot } from "@/lib/fanta/types";

export const dynamic = "force-dynamic";

const ROLE_ORDER: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 };

interface SquadPlayer {
  id: number;
  name: string;
  club: string;
  clubId: number;
  role: string;
  cost: number;
  averageGrade: number;
  averageFantaGrade: number;
  marketValue: number;
  live: ReturnType<typeof liveOf>;
}

function liveOf(id: number, snapshot: LiveSnapshot | null) {
  const player = snapshot?.byId[id];
  if (!player) return null;
  const scored = scorePlayer(player);
  return {
    grade: scored.grade,
    bonus: scored.bonus,
    fantavoto: scored.fantavoto,
    hasVote: scored.hasVote,
    onField: player.onField,
    startProbability: player.startProbability,
    matchState: player.matchState,
    teamId: player.teamId,
  };
}

const byRoleThenCost = (a: SquadPlayer, b: SquadPlayer) =>
  ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
  b.cost - a.cost ||
  b.averageFantaGrade - a.averageFantaGrade;

/**
 * A fantasy team's squad, with each player's live Serie A rating.
 *
 * Two ways in, and the better one is tried first. A signed-in member of the
 * league gets the roster from the league API, purchase prices included. Everyone
 * else gets it from the statistics service, which answers without a session and
 * knows every owned player — but reports season form rather than what anyone
 * paid, so costs come back as zero and `source` says which reading this was.
 *
 * Either way the live ratings come from the public feed; merging them is what
 * makes the squad useful during a matchweek rather than just a list of names.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ alias: string; teamId: string }> },
) {
  const { alias, teamId } = await context.params;
  const id = Number(teamId);
  const session = await currentSession();
  const league = session?.leagues.find(
    (l) => l.alias.toLowerCase() === alias.toLowerCase(),
  );

  const snapshot = await getCurrentSnapshot().catch(() => null);

  if (session && league) {
    const [teams, players] = await Promise.all([
      getLeagueTeamsFull(league, session.cookie).catch(() => []),
      getLeaguePlayers(league, session.cookie).catch(() => new Map()),
    ]);

    const team = teams.find((t) => t.id === id);
    if (team) {
      const squad = team.roster
        .map((playerId, i): SquadPlayer | null => {
          const player = players.get(playerId);
          if (!player) return null;
          return {
            id: playerId,
            name: player.name,
            club: player.club,
            clubId: player.clubId,
            role: player.role,
            cost: team.costs[i] ?? 0,
            averageGrade: player.averageGrade,
            averageFantaGrade: player.averageFantaGrade,
            marketValue: player.marketValue,
            live: liveOf(playerId, snapshot),
          };
        })
        .filter((p): p is SquadPlayer => p != null)
        .sort(byRoleThenCost);

      return NextResponse.json({
        source: "league",
        team: {
          id: team.id,
          name: team.name,
          manager: team.manager,
          logo: team.logo,
          creditsLeft: team.creditsLeft,
        },
        squad,
        matchweek: snapshot?.matchweek ?? null,
      });
    }
  }

  // No session, or a league this account is not in: read it publicly instead.
  const publicLeague = await fetchPublicLeague(alias).catch(() => null);
  const publicTeam = publicLeague?.teams.find((t) => t.id === id);
  if (!publicLeague || !publicTeam) {
    return NextResponse.json(
      { error: "Squadra non trovata.", signedIn: !!session },
      { status: 404 },
    );
  }

  const roster = await fetchRoster(alias, publicLeague.leagueId, id).catch(
    () => null,
  );
  if (!roster) {
    return NextResponse.json(
      { error: "Rosa non leggibile.", signedIn: !!session },
      { status: 404 },
    );
  }

  // The statistics service names a player's club but does not give its id, and
  // the current matchweek's feed is empty until its ratings land — so between
  // matchweeks the crests would all disappear. The player index spans the last
  // few matchweeks and is what identities are read from; only the ratings below
  // are taken from the current snapshot.
  const index = await getPlayerIndex().catch(() => []);
  const clubOf = new Map(index.map((p) => [p.id, p.teamId]));

  const squad = roster
    .map((player: PublicRosterPlayer): SquadPlayer => {
      const live = liveOf(player.id, snapshot);
      return {
        id: player.id,
        name: player.name,
        club: player.club,
        clubId: live?.teamId ?? clubOf.get(player.id) ?? 0,
        role: player.role,
        cost: 0,
        averageGrade: player.averageGrade,
        averageFantaGrade: player.averageFantaGrade,
        marketValue: 0,
        live,
      };
    })
    .sort(byRoleThenCost);

  return NextResponse.json({
    source: "public",
    team: {
      id: publicTeam.id,
      name: publicTeam.name,
      manager: publicTeam.manager,
      logo: publicTeam.logo,
      creditsLeft: 0,
    },
    squad,
    matchweek: snapshot?.matchweek ?? null,
  });
}
