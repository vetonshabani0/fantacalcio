import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import {
  getCompetitions,
  getLeaguePlayers,
  getLeagueTeamsFull,
  getMatchDetail,
  getOfficialCalendar,
  type MatchDetail,
} from "@/lib/fanta/official";
import { toBoardPlayer, type BoardPlayer } from "@/lib/api-types";
import { getSnapshot, resolvePointer } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/** One fixture, with both starting elevens and the bench. */
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ alias: string; mw: string; teamA: string; teamB: string }>;
  },
) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  const { alias, mw, teamA, teamB } = await context.params;
  const league = session.leagues.find(
    (l) => l.alias.toLowerCase() === alias.toLowerCase(),
  );
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata." }, { status: 404 });
  }

  const [teams, players, competitions] = await Promise.all([
    getLeagueTeamsFull(league, session.cookie).catch(() => []),
    getLeaguePlayers(league, session.cookie).catch(() => new Map()),
    getCompetitions(league, session.cookie).catch(() => []),
  ]);

  const competitionId = competitions[0]?.id;
  if (!competitionId) {
    return NextResponse.json(
      { error: "Nessuna competizione trovata." },
      { status: 404 },
    );
  }

  // The lineup endpoint wants the Serie A matchweek as well as the league's,
  // so the fixture is looked up first to supply both.
  const matchweek = Number(mw);
  const a = Number(teamA);
  const b = Number(teamB);
  const calendar = await getOfficialCalendar(
    league,
    competitionId,
    session.cookie,
  ).catch(() => []);

  const fixture = calendar.find(
    (f) =>
      f.matchweek === matchweek &&
      ((f.homeTeamId === a && f.awayTeamId === b) ||
        (f.homeTeamId === b && f.awayTeamId === a)),
  );
  if (!fixture) {
    return NextResponse.json({ error: "Incontro non trovato." }, { status: 404 });
  }

  const detail = await getMatchDetail(
    league,
    competitionId,
    fixture.matchweek,
    fixture.serieAMatchweek,
    fixture.homeTeamId,
    fixture.awayTeamId,
    players,
    session.cookie,
  );

  if (!detail) {
    return NextResponse.json(
      { error: "Formazioni non disponibili per questo incontro." },
      { status: 404 },
    );
  }

  const named = (id: number) => {
    const t = teams.find((x) => x.id === id);
    return { name: t?.name ?? `#${id}`, logo: t?.logo ?? null };
  };

  // The lineup endpoint gives each slot a rating and the score that counted,
  // but never says how it was arrived at. The public feed does, so every player
  // in either eleven is looked up there and shipped alongside — that is what
  // lets a tapped player explain his fantavoto rather than just assert it.
  const breakdowns = await liveBreakdowns(detail).catch(() => ({}));

  return NextResponse.json({
    ...detail,
    home: { ...detail.home, ...named(detail.home.teamId) },
    away: { ...detail.away, ...named(detail.away.teamId) },
    breakdowns,
  });
}

async function liveBreakdowns(
  detail: MatchDetail,
): Promise<Record<number, BoardPlayer>> {
  const pointer = await resolvePointer();
  const snapshot = await getSnapshot(pointer.seasonId, detail.serieAMatchweek);
  if (!snapshot) return {};

  const out: Record<number, BoardPlayer> = {};
  for (const side of [detail.home, detail.away]) {
    for (const slot of [...side.starters, ...side.bench]) {
      const player = snapshot.byId[slot.playerId];
      if (player) out[slot.playerId] = toBoardPlayer(player);
    }
  }
  return out;
}
