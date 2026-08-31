import { NextResponse } from "next/server";
import { getCurrentSnapshot, isLiveNow, resolvePointer } from "@/lib/fanta/source";
import { scorePlayer } from "@/lib/fanta/scoring";

export const dynamic = "force-dynamic";

/** The full live board: fixtures plus every rated player, already scored. */
export async function GET() {
  const [pointer, snapshot] = await Promise.all([
    resolvePointer(),
    getCurrentSnapshot(),
  ]);

  if (!snapshot) {
    return NextResponse.json(
      { error: "Feed non disponibile" },
      { status: 503 },
    );
  }

  const players = snapshot.players.map((player) => {
    const scored = scorePlayer(player);
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      teamId: player.teamId,
      teamName: player.teamName,
      grade: scored.grade,
      bonus: scored.bonus,
      fantavoto: scored.fantavoto,
      hasVote: scored.hasVote,
      breakdown: scored.breakdown,
      events: player.events,
      onField: player.onField,
      startProbability: player.startProbability,
      replacedPlayerId: player.replacedPlayerId,
      matchState: player.matchState,
    };
  });

  return NextResponse.json({
    pointer,
    live: isLiveNow(snapshot),
    fetchedAt: snapshot.fetchedAt,
    matches: snapshot.matches,
    players,
  });
}
