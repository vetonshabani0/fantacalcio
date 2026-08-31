import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/fanta/source";

export const dynamic = "force-dynamic";

/** Searchable player index used by the roster builder. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const role = url.searchParams.get("role");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 300);

  let players = await getPlayerIndex();
  if (role) players = players.filter((p) => p.role === role);
  if (query) {
    players = players.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.teamName.toLowerCase().includes(query),
    );
  }

  return NextResponse.json({
    players: players.slice(0, limit).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      teamId: p.teamId,
      teamName: p.teamName,
    })),
    total: players.length,
  });
}
