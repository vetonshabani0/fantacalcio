import { NextResponse } from "next/server";
import { writeSession } from "@/lib/auth-session";
import { login, OfficialError } from "@/lib/fanta/official";

export const dynamic = "force-dynamic";

/**
 * Forwards the user's own Leghe Fantacalcio credentials to the official login
 * endpoint. The password is used for this one request and never stored; only
 * the resulting tokens are kept, in memory, behind an httpOnly cookie.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Servono username e password." },
      { status: 400 },
    );
  }

  try {
    const session = await login(username, password);

    if (session.leagues.length === 0) {
      // Surface the payload shape rather than a bare message: this is the one
      // spot where "no leagues" and "parsed the response wrongly" look alike.
      return NextResponse.json(
        {
          error:
            "Accesso riuscito, ma non ho letto nessuna lega da questo account.",
          shape: session.shape,
        },
        { status: 200 },
      );
    }

    const response = NextResponse.json({
      username: session.user.username,
      leagues: session.leagues.map((l) => ({
        id: l.id,
        name: l.name,
        alias: l.alias,
        type: l.type,
        isAdmin: l.isAdmin,
      })),
    });

    writeSession(response, session);
    return response;
  } catch (error) {
    const status = error instanceof OfficialError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Login non riuscito.",
      },
      { status: status === 400 ? 401 : status },
    );
  }
}
