import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/** The signed-in account's real leagues, optionally filtered by name. */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ signedIn: false });

  const query = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .toLowerCase();

  const leagues = session.leagues
    .filter(
      (l) =>
        !query ||
        l.name.toLowerCase().includes(query) ||
        l.alias.toLowerCase().includes(query),
    )
    .map((l) => ({
      id: l.id,
      name: l.name,
      alias: l.alias,
      type: l.type,
      isAdmin: l.isAdmin,
    }));

  return NextResponse.json({
    signedIn: true,
    username: session.user.username,
    total: session.leagues.length,
    leagues,
  });
}
