import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import {
  getLeaguePlayers,
  getLeagueTeamsFull,
} from "@/lib/fanta/official";
import { scorePlayer } from "@/lib/fanta/scoring";
import { getCurrentSnapshot } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

const ROLE_ORDER: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 };

/**
 * A fantasy team's squad, with each player's live Serie A rating.
 *
 * The roster comes from the league API, which needs the member's session; the
 * live ratings come from the public feed. Merging them is what makes the squad
 * useful during a matchweek rather than just a list of names.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ alias: string; teamId: string }> },
) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non autenticato.", signedIn: false },
      { status: 401 },
    );
  }

  const { alias, teamId } = await context.params;
  const league = session.leagues.find(
    (l) => l.alias.toLowerCase() === alias.toLowerCase(),
  );
  if (!league) {
    return NextResponse.json(
      { error: "Questa lega non è fra quelle del tuo account." },
      { status: 404 },
    );
  }

  const [teams, players, snapshot] = await Promise.all([
    getLeagueTeamsFull(league, session.cookie).catch(() => []),
    getLeaguePlayers(league, session.cookie).catch(() => new Map()),
    getCurrentSnapshot().catch(() => null),
  ]);

  const team = teams.find((t) => t.id === Number(teamId));
  if (!team) {
    return NextResponse.json({ error: "Squadra non trovata." }, { status: 404 });
  }

  const squad = team.roster
    .map((id, i) => {
      const player = players.get(id);
      if (!player) return null;

      const live = snapshot?.byId[id];
      const scored = live ? scorePlayer(live) : null;

      return {
        id,
        name: player.name,
        club: player.club,
        clubId: player.clubId,
        role: player.role,
        cost: team.costs[i] ?? 0,
        averageGrade: player.averageGrade,
        averageFantaGrade: player.averageFantaGrade,
        marketValue: player.marketValue,
        live: scored
          ? {
              grade: scored.grade,
              bonus: scored.bonus,
              fantavoto: scored.fantavoto,
              hasVote: scored.hasVote,
              onField: live!.onField,
              startProbability: live!.startProbability,
              matchState: live!.matchState,
              teamId: live!.teamId,
            }
          : null,
      };
    })
    .filter((p) => p != null)
    .sort(
      (a, b) => ROLE_ORDER[a!.role] - ROLE_ORDER[b!.role] || b!.cost - a!.cost,
    );

  return NextResponse.json({
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
