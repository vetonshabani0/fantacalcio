import { NextResponse } from "next/server";
import { fetchPublicLeague } from "@/lib/fanta/public-league";
import { estimateLive, serieAMatchweekFor } from "@/lib/fanta/public-live";
import { getCurrentSnapshot, getSnapshot, resolvePointer } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/** A real league's standings, read without credentials. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ alias: string }> },
) {
  const { alias } = await context.params;

  const [league, snapshot] = await Promise.all([
    fetchPublicLeague(alias).catch(() => null),
    getCurrentSnapshot().catch(() => null),
  ]);

  if (!league) {
    return NextResponse.json(
      { error: "Lega non leggibile o inesistente." },
      { status: 404 },
    );
  }

  // The standings above stop at the last calculated matchweek. The current one
  // is only reconstructible, and only once its ratings start arriving.
  const live = snapshot?.matches.some((m) => m.state === "live") ?? false;
  const estimate = await currentEstimate(league).catch(() => null);

  return NextResponse.json({
    league,
    serieA: snapshot ? { matchweek: snapshot.matchweek, live } : null,
    estimate,
  });
}

async function currentEstimate(
  league: NonNullable<Awaited<ReturnType<typeof fetchPublicLeague>>>,
) {
  const serieA = serieAMatchweekFor(league, league.currentMatchweek);
  const pointer = await resolvePointer();
  const snapshot = await getSnapshot(pointer.seasonId, serieA);
  if (!snapshot || snapshot.players.length === 0) return null;
  return estimateLive(league, snapshot, league.currentMatchweek);
}
