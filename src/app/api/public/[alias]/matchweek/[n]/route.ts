import { NextResponse } from "next/server";
import {
  buildMatchweekView,
  fetchAllHistories,
  fetchPublicLeague,
  type PublicLeague,
} from "@/lib/fanta/public-league";
import { estimateLive, serieAMatchweekFor } from "@/lib/fanta/public-live";
import { getSnapshot, resolvePointer } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/** When the Serie A round a fantasy matchweek is played on gets under way. */
export interface MatchweekSchedule {
  serieAMatchweek: number;
  /** Kickoff of the first match, as published. Null before the bucket has it. */
  firstKickoff: string | null;
  /** Kickoff of the last match, when the round finishes filling in. */
  lastKickoff: string | null;
  matches: number;
  started: boolean;
  complete: boolean;
}

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
  const [estimate, schedule] = await Promise.all([
    view.settled ? null : buildEstimate(league, matchweek).catch(() => null),
    buildSchedule(league, matchweek).catch(() => null),
  ]);

  return NextResponse.json({
    league: {
      alias: league.alias,
      competitionName: league.competitionName,
    },
    view,
    estimate,
    schedule,
  });
}

async function buildEstimate(league: PublicLeague, matchweek: number) {
  const serieA = serieAMatchweekFor(league, matchweek);
  const pointer = await resolvePointer();
  const snapshot = await getSnapshot(pointer.seasonId, serieA);
  // Nothing to rebuild from before the bucket publishes the matchweek.
  if (!snapshot || snapshot.players.length === 0) return null;

  return estimateLive(league, snapshot, matchweek);
}

/**
 * When this matchweek kicks off.
 *
 * The bucket publishes a round's fixtures well before its ratings — the file
 * appears with the ten Serie A matches and their kickoff times while `pl` is
 * still empty — so a matchweek nobody has played can still say when it starts.
 * Rounds further out than Serie A has scheduled answer 403, and get a null
 * rather than an invented date.
 */
async function buildSchedule(
  league: PublicLeague,
  matchweek: number,
): Promise<MatchweekSchedule | null> {
  const serieAMatchweek = serieAMatchweekFor(league, matchweek);
  const pointer = await resolvePointer();
  const snapshot = await getSnapshot(pointer.seasonId, serieAMatchweek);
  if (!snapshot || snapshot.matches.length === 0) return null;

  const kickoffs = snapshot.matches
    .map((m) => m.kickoff)
    .filter((k): k is string => !!k)
    .sort();

  return {
    serieAMatchweek,
    firstKickoff: kickoffs[0] ?? null,
    lastKickoff: kickoffs[kickoffs.length - 1] ?? null,
    matches: snapshot.matches.length,
    started: snapshot.matches.some((m) => m.state !== "pre-match"),
    complete: snapshot.matches.every(
      (m) => m.state === "finished" || m.state === "postponed",
    ),
  };
}
