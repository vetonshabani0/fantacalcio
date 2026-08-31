import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Configuration check for a deployed instance.
 *
 * Reports whether the pieces the app needs are actually in place, without ever
 * revealing their values. Its main job is `sessionSecret`: without it a
 * production login is accepted upstream and then fails while sealing the
 * session, which is confusing to diagnose from the outside.
 */
export async function GET() {
  const feed = await fetch(
    "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live/21/live_2.json",
    { method: "HEAD", cache: "no-store" },
  )
    .then((r) => r.ok)
    .catch(() => false);

  const secret = process.env.SESSION_SECRET;

  return NextResponse.json({
    ok: true,
    sessionSecret: {
      configured: !!secret && secret.length >= 16,
      // Length only, never the value, so a truncated paste is still visible.
      length: secret?.length ?? 0,
    },
    liveFeedReachable: feed,
    environment: process.env.VERCEL_ENV ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    builtFromSource: !!process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
