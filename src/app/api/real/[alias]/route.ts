import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import {
  getCompetitions,
  getLeagueStatus,
  getLineups,
  getStandings,
  OfficialError,
} from "@/lib/fanta/official";
import { getCurrentSnapshot } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/** Picks the first present key, so one normaliser copes with both backends. */
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null) return row[key];
  }
  return undefined;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The legacy standings service names its columns differently per league type,
 * so each field is resolved from a list of candidates rather than assumed.
 */
function normaliseStanding(row: Record<string, unknown>, index: number) {
  return {
    position: num(pick(row, ["posizione", "pos", "rank", "position"])) || index + 1,
    teamId: String(pick(row, ["id_squadra", "idSquadra", "squadra_id", "id"]) ?? ""),
    teamName: String(
      pick(row, ["nome_squadra", "nomeSquadra", "squadra", "nome", "name"]) ??
        "—",
    ),
    manager: String(
      pick(row, ["utente", "username", "nome_utente", "manager"]) ?? "",
    ),
    played: num(pick(row, ["giocate", "partite", "pg", "played"])),
    won: num(pick(row, ["vinte", "v", "won"])),
    drawn: num(pick(row, ["pareggiate", "n", "pari", "drawn"])),
    lost: num(pick(row, ["perse", "p", "lost"])),
    goalsFor: num(pick(row, ["gol_fatti", "golFatti", "gf", "goalsFor"])),
    goalsAgainst: num(
      pick(row, ["gol_subiti", "golSubiti", "gs", "goalsAgainst"]),
    ),
    points: num(pick(row, ["punti", "pt", "points"])),
    fantapunti: num(
      pick(row, ["punti_totali", "puntiTotali", "totale", "fantapunti", "tot"]),
    ),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ alias: string }> },
) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      {
        error: "Non autenticato. Accedi dalla home con il tuo account Fantacalcio.",
        signedIn: false,
      },
      { status: 401 },
    );
  }

  const { alias } = await context.params;
  const league = session.leagues.find(
    (l) => l.alias.toLowerCase() === alias.toLowerCase(),
  );
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const [competitions, status, snapshot] = await Promise.all([
      getCompetitions(league, session.cookie).catch(() => []),
      getLeagueStatus(league, session.cookie).catch(() => null),
      getCurrentSnapshot(),
    ]);

    const requested = Number(url.searchParams.get("competition"));
    const competition =
      competitions.find((c) => c.id === requested) ?? competitions[0] ?? null;

    const statusRecord = (status ?? {}) as Record<string, unknown>;
    const requestedWeek = Number(url.searchParams.get("matchweek"));
    const matchweek =
      Number.isFinite(requestedWeek) && requestedWeek > 0
        ? requestedWeek
        : num(pick(statusRecord, ["matchweek", "giornata", "mday"])) ||
          snapshot?.matchweek ||
          1;

    const [standingsRaw, lineupsRaw] = await Promise.all([
      competition
        ? getStandings(league, competition.id, session.cookie).catch(() => [])
        : Promise.resolve([]),
      competition
        ? getLineups(league, competition.id, matchweek, session.cookie).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      signedIn: true,
      league: {
        id: league.id,
        name: league.name,
        alias: league.alias,
        type: league.type,
      },
      competitions,
      competitionId: competition?.id ?? null,
      matchweek,
      live: snapshot?.matches.some((m) => m.state === "live") ?? false,
      realMatchweek: snapshot?.matchweek ?? null,
      standings: standingsRaw.map(normaliseStanding),
      // Kept until the exact wire shapes are pinned down against a real account.
      raw: debug
        ? { status, competitions, standings: standingsRaw, lineups: lineupsRaw }
        : undefined,
    });
  } catch (error) {
    const status = error instanceof OfficialError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore" },
      { status },
    );
  }
}
