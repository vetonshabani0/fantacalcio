import { NextResponse } from "next/server";
import { fetchPublicLeague, searchLeagues } from "@/lib/fanta/public-league";

export const dynamic = "force-dynamic";

/**
 * Finds real leagues by name, with no sign-in.
 *
 * Each hit is resolved far enough to show its real title and size, so the user
 * picks a recognisable league rather than a bare slug.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ results: [] });

  const aliases = await searchLeagues(query);

  const results = await Promise.all(
    aliases.slice(0, 6).map(async (alias) => {
      const league = await fetchPublicLeague(alias).catch(() => null);
      return {
        alias,
        name: league?.competitionName || alias,
        teamCount: league?.teams.length ?? 0,
        president: league?.president ?? "",
        readable: !!league,
      };
    }),
  );

  // A league whose page exists but exposes nothing is a dead end. Worth offering
  // when it is all there is — the user may still recognise the name — but never
  // ahead of, or padding out, leagues that can actually be opened.
  const readable = results.filter((r) => r.readable);
  return NextResponse.json({ results: readable.length ? readable : results });
}
