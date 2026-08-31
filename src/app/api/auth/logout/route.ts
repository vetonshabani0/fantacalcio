import { NextResponse } from "next/server";
import {
  currentSessionId,
  destroySession,
  SESSION_COOKIE,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  destroySession(await currentSessionId());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
