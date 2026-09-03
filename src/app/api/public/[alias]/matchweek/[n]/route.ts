import { NextResponse } from "next/server";
import {
  buildMatchweekView,
  fetchAllHistories,
  fetchPublicLeague,
} from "@/lib/fanta/public-league";
import { estimateLive, serieAMatchweekFor } from "@/lib/fanta/public-live";
import { getSnapshot, resolvePointer } from "@/lib/fanta/source";

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

  const view = buildMatchweekView(league, histories, matchweek);

  // A matchweek the league has not calculated has no public figures at all, so
  // it is the one worth rebuilding from the squads and the Serie A feed. Once
  // the league has settled it, its own numbers are the truth and stand alone.
  const estimate = view.settled
    ? null
    : await buildEstimate(league, matchweek).catch(() => null);

  return NextResponse.json({
    league: {
      alias: league.alias,
      competitionName: league.competitionName,
    },
    view,
    estimate,
  });
}

async function buildEstimate(
  league: Awaited<ReturnType<typeof fetchPublicLeague>>,
  matchweek: number,
) {
  if (!league) return null;

  const serieA = serieAMatchweekFor(league, matchweek);
  const pointer = await resolvePointer();
  const snapshot = await getSnapshot(pointer.seasonId, serieA);
  // Nothing to rebuild from before the bucket publishes the matchweek.
  if (!snapshot || snapshot.players.length === 0) return null;

  return estimateLive(league, snapshot, matchweek);
}
