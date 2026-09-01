import { NextResponse } from "next/server";
import {
  buildMatchweekView,
  fetchAllHistories,
  fetchPublicLeague,
} from "@/lib/fanta/public-league";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ alias: string; n: string }> },
) {
  const { alias, n } = await context.params;

  const league = await fetchPublicLeague(alias).catch(() => null);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const histories = await fetchAllHistories(league);
  const requested = Number(n);
  const lastSettled = Math.max(
    1,
    ...[...histories.values()].flatMap((rows) =>
      rows.filter((r) => r.settled).map((r) => r.matchweek),
    ),
  );

  const matchweek = Number.isFinite(requested)
    ? Math.min(Math.max(1, requested), league.lastMatchweek)
    : lastSettled;

  return NextResponse.json({
    league: {
      alias: league.alias,
      competitionName: league.competitionName,
    },
    view: buildMatchweekView(league, histories, matchweek),
  });
}
