import { NextResponse } from "next/server";
import {
  lineupFor,
  lineupKey,
  realMatchweekFor,
} from "@/lib/fanta/league";
import { lineupErrors, scorePlayer, type Lineup } from "@/lib/fanta/scoring";
import { getPlayerIndex, getSnapshot } from "@/lib/fanta/source";
import { loadLeague, saveLeague } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The team's roster plus the lineup currently in force for a matchweek. */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const league = await loadLeague(code);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId") ?? "";
  const matchweek = Number(url.searchParams.get("matchweek") ?? 1);

  const team = league.teams.find((t) => t.id === teamId);
  if (!team) {
    return NextResponse.json({ error: "Squadra non trovata" }, { status: 404 });
  }

  const snapshot = await getSnapshot(
    league.seasonId,
    realMatchweekFor(league, matchweek),
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Dati di giornata non disponibili" },
      { status: 503 },
    );
  }

  const { lineup, auto } = lineupFor(league, team, matchweek, snapshot);

  const roster = team.roster
    .map((id) => snapshot.byId[id])
    .filter((p) => p != null)
    .map((player) => {
      const scored = scorePlayer(player, league.rules);
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        teamName: player.teamName,
        grade: scored.grade,
        fantavoto: scored.fantavoto,
        hasVote: scored.hasVote,
        startProbability: player.startProbability,
        matchState: player.matchState,
      };
    });

  return NextResponse.json({
    teamId: team.id,
    teamName: team.name,
    matchweek,
    lineup,
    auto,
    roster,
    formations: league.rules.formations,
    locked: snapshot.matches.some((m) => m.state !== "pre-match"),
  });
}

interface Body {
  teamId: string;
  matchweek: number;
  lineup: Lineup;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const league = await loadLeague(code);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.teamId || !body.lineup) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const team = league.teams.find((t) => t.id === body.teamId);
  if (!team) {
    return NextResponse.json({ error: "Squadra non trovata" }, { status: 404 });
  }

  const roster = new Set(team.roster);
  const chosen = [...body.lineup.starters, ...body.lineup.bench];
  if (chosen.some((id) => !roster.has(id))) {
    return NextResponse.json(
      { error: "La formazione contiene giocatori fuori rosa" },
      { status: 400 },
    );
  }

  const index = await getPlayerIndex();
  const roleOf = new Map(index.map((p) => [p.id, p.role]));
  const errors = lineupErrors(body.lineup, (id) => roleOf.get(id) ?? null);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  league.lineups[lineupKey(team.id, body.matchweek)] = body.lineup;
  await saveLeague(league);

  return NextResponse.json({ ok: true });
}
