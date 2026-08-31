import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import {
  getCalendar,
  getCompetitions,
  getLeagueStatus,
  getLeagueTeams,
  getLineups,
  getStandings,
} from "@/lib/fanta/official";

export const dynamic = "force-dynamic";

/**
 * Dumps the raw upstream payloads for one league.
 *
 * The official responses are undocumented and vary by league type, so this
 * exists to pin the exact field names down against a real account rather than
 * guessing. Read-only, and it never returns tokens or cookies.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      {
        error: "Non autenticato",
        howTo:
          "Accedi prima su http://localhost:3210 con il tuo account Fantacalcio, poi riapri questo indirizzo NELLA STESSA finestra del browser. Il cookie di sessione è httpOnly, quindi curl non lo invia.",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const alias = url.searchParams.get("alias");
  const league =
    session.leagues.find((l) => l.alias === alias) ?? session.leagues[0];

  if (!league) {
    return NextResponse.json({ error: "Nessuna lega" }, { status: 404 });
  }

  const attempt = async <T>(label: string, run: () => Promise<T>) => {
    try {
      return { ok: true as const, value: await run() };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
        label,
      };
    }
  };

  const competitions = await attempt("competitions", () =>
    getCompetitions(league, session.cookie),
  );
  const competitionId =
    competitions.ok && competitions.value[0] ? competitions.value[0].id : null;
  const matchweek = Number(url.searchParams.get("matchweek") ?? 2);

  return NextResponse.json({
    league: { id: league.id, name: league.name, alias: league.alias, type: league.type },
    competitions,
    status: await attempt("status", () => getLeagueStatus(league, session.cookie)),
    teams: await attempt("teams", () => getLeagueTeams(league, session.cookie)),
    standings: competitionId
      ? await attempt("standings", () =>
          getStandings(league, competitionId, session.cookie),
        )
      : null,
    calendar: competitionId
      ? await attempt("calendar", () =>
          getCalendar(league, competitionId, session.cookie),
        )
      : null,
    lineups: competitionId
      ? await attempt("lineups", () =>
          getLineups(league, competitionId, matchweek, session.cookie),
        )
      : null,
  });
}
