import { NextResponse } from "next/server";
import { toBoardPlayer } from "@/lib/api-types";
import {
  getCurrentSnapshot,
  getSnapshot,
  isLiveNow,
  resolvePointer,
} from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/**
 * The full live board: fixtures plus every rated player, already scored.
 *
 * Defaults to the matchweek being played. `?matchweek=` asks for a specific one,
 * which callers use when they are explaining figures from a round that is not
 * the current one — a league whose own matchweek lags Serie A's, say.
 */
export async function GET(request: Request) {
  const wanted = Number(new URL(request.url).searchParams.get("matchweek"));
  const pointer = await resolvePointer();
  const snapshot =
    Number.isFinite(wanted) && wanted >= 1
      ? await getSnapshot(pointer.seasonId, wanted)
      : await getCurrentSnapshot();

  if (!snapshot) {
    return NextResponse.json(
      { error: "Feed non disponibile" },
      { status: 503 },
    );
  }

  const players = snapshot.players.map((p) => toBoardPlayer(p));

  return NextResponse.json({
    pointer,
    live: isLiveNow(snapshot),
    fetchedAt: snapshot.fetchedAt,
    matches: snapshot.matches,
    players,
  });
}
