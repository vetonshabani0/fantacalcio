import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";
import { parseCalendarWorkbook } from "@/lib/fanta/calendar-import";
import {
  downloadCalendarExcel,
  getCompetitions,
  getOfficialCalendar,
} from "@/lib/fanta/official";
import { fetchPublicLeague } from "@/lib/fanta/public-league";

export const dynamic = "force-dynamic";

/**
 * Fetches the signed-in member's calendar, so nobody has to download and
 * re-upload a spreadsheet by hand.
 *
 * Two routes to the same answer: the newer API's JSON calendar, and failing
 * that the spreadsheet export, which is fetched here with the member's session
 * and put through the same parser the manual upload uses. Whichever succeeds,
 * the caller gets identical fixtures — nothing is stored server-side.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ alias: string }> },
) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non autenticato. Accedi con il tuo account Fantacalcio." },
      { status: 401 },
    );
  }

  const { alias } = await context.params;
  const league = session.leagues.find(
    (l) => l.alias.toLowerCase() === alias.toLowerCase(),
  );
  if (!league) {
    return NextResponse.json(
      { error: "Questa lega non è fra quelle del tuo account." },
      { status: 404 },
    );
  }

  // Team ids and names come from the public reader, so the fixtures line up
  // with what the rest of the app already renders.
  const publicLeague = await fetchPublicLeague(alias).catch(() => null);
  if (!publicLeague) {
    return NextResponse.json(
      { error: "Non riesco a leggere le squadre della lega." },
      { status: 502 },
    );
  }

  const requested = Number(new URL(request.url).searchParams.get("competition"));
  const competitions = await getCompetitions(league, session.cookie).catch(
    () => [],
  );
  const competition =
    competitions.find((c) => c.id === requested) ??
    competitions.find((c) => c.id === publicLeague.competitionId) ??
    competitions[0];

  const competitionId = competition?.id ?? publicLeague.competitionId;
  const competitionName = competition?.name ?? publicLeague.competitionName;

  const attempts: string[] = [];

  // The official calendar carries the real pairings and the results the league
  // recorded, so nothing has to be derived from thresholds.
  const official = await getOfficialCalendar(
    league,
    competitionId,
    session.cookie,
  ).catch(() => []);

  if (official.length) {
    const fixtures = official.map((f) => ({
      matchweek: f.matchweek,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      ...(f.calculated
        ? {
            homeGoals: f.homeGoals,
            awayGoals: f.awayGoals,
            homeFantapoints: f.homeFantapoints,
            awayFantapoints: f.awayFantapoints,
          }
        : {}),
    }));
    return NextResponse.json({
      source: "api",
      fixtures,
      matchweeks: new Set(fixtures.map((f) => f.matchweek)).size,
    });
  }
  attempts.push("the API calendar returned nothing recognisable");

  const workbook = await downloadCalendarExcel(
    league,
    competitionId,
    competitionName,
    session.cookie,
  );
  if (workbook) {
    const result = parseCalendarWorkbook(
      workbook,
      publicLeague.teams.map((t) => ({ id: t.id, name: t.name })),
    );
    if (result.fixtures.length) {
      return NextResponse.json({
        source: "excel",
        fixtures: result.fixtures,
        matchweeks: result.matchweeks,
      });
    }
    attempts.push("the spreadsheet export had no recognisable fixtures");
  } else {
    attempts.push("the spreadsheet export was refused");
  }

  return NextResponse.json(
    { error: `Calendario non recuperato: ${attempts.join("; ")}.` },
    { status: 502 },
  );
}
