import { NextResponse } from "next/server";
import { findEntry } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Resolves a league code, team name or manager name into a destination. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const result = await findEntry(query);

  switch (result.kind) {
    case "league":
      return NextResponse.json({
        kind: "league",
        href: `/lega/${result.league.code}`,
        name: result.league.name,
      });
    case "team": {
      const team = result.league.teams.find((t) => t.id === result.teamId);
      return NextResponse.json({
        kind: "team",
        href: `/lega/${result.league.code}?team=${result.teamId}`,
        name: team?.name ?? "",
        league: result.league.name,
      });
    }
    case "ambiguous":
      return NextResponse.json({
        kind: "ambiguous",
        options: result.matches.map((m) => {
          const team = m.league.teams.find((t) => t.id === m.teamId);
          return {
            href: `/lega/${m.league.code}?team=${m.teamId}`,
            team: team?.name ?? "",
            manager: team?.manager ?? "",
            league: m.league.name,
            code: m.league.code,
          };
        }),
      });
    default:
      return NextResponse.json({ kind: "none" });
  }
}
