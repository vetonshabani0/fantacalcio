import { NextResponse } from "next/server";
import { fetchPublicLeague } from "@/lib/fanta/public-league";
import { getCurrentSnapshot } from "@/lib/fanta/source";

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

  return NextResponse.json({
    league,
    serieA: snapshot
      ? {
          matchweek: snapshot.matchweek,
          live: snapshot.matches.some((m) => m.state === "live"),
        }
      : null,
  });
}
