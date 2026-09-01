import { NextResponse } from "next/server";
import { fetchHistory, fetchPublicLeague } from "@/lib/fanta/public-league";

export const dynamic = "force-dynamic";

/**
 * One team's full public record, plus an optional comparison with another team
 * in the same league.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ alias: string; teamId: string }> },
) {
  const { alias, teamId } = await context.params;
  const id = Number(teamId);

  const league = await fetchPublicLeague(alias).catch(() => null);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const team = league.teams.find((t) => t.id === id);
  if (!team) {
    return NextResponse.json({ error: "Squadra non trovata" }, { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get("vs"));
  // Any other team works as the second argument; the figures are per-team.
  const other =
    league.teams.find((t) => t.id === requested) ??
    league.teams.find((t) => t.id !== id) ??
    team;

  const history = await fetchHistory(
    league.leagueId,
    league.competitionId,
    id,
    other.id,
  ).catch(() => null);

  return NextResponse.json({
    league: {
      alias: league.alias,
      competitionName: league.competitionName,
      lastMatchweek: league.lastMatchweek,
    },
    team,
    opponent: other.id === team.id ? null : other,
    history: history?.a.rows ?? [],
    opponentHistory: history?.b.rows ?? [],
    teams: league.teams.map((t) => ({ id: t.id, name: t.name, logo: t.logo })),
  });
}
