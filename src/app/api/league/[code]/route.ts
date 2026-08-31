import { NextResponse } from "next/server";
import { buildLeagueView } from "@/lib/league-view";
import { loadLeague } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const league = await loadLeague(code);
  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("matchweek");
  const matchweek = raw ? Number(raw) : undefined;

  const view = await buildLeagueView(
    league,
    Number.isFinite(matchweek) ? matchweek : undefined,
  );
  if (!view) {
    return NextResponse.json(
      { error: "Dati di giornata non disponibili" },
      { status: 503 },
    );
  }

  return NextResponse.json(view);
}
