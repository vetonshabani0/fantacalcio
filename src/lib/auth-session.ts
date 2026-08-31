import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { OfficialSession } from "./fanta/official";

/**
 * Sessions live in memory only, never on disk.
 *
 * They hold the league bearer tokens and the upstream cookies, so writing them
 * to `.data/` would leave long-lived credentials lying around the repo. The
 * cost is that a dev-server restart means logging in again, which is the right
 * trade for something that grants access to a real account. The password
 * itself is never stored at all — it is forwarded once and discarded.
 */

const TTL = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE = "fl_session";

interface Entry {
  session: OfficialSession;
  createdAt: number;
}

// Survives hot reloads in dev, which would otherwise log the user out on edit.
const key = Symbol.for("fantalive.sessions");
const scope = globalThis as unknown as Record<symbol, Map<string, Entry>>;
if (!scope[key]) scope[key] = new Map();
const store = scope[key];

function sweep(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL) store.delete(id);
  }
}

export function createSession(session: OfficialSession): string {
  sweep();
  const id = randomBytes(24).toString("base64url");
  store.set(id, { session, createdAt: Date.now() });
  return id;
}

export function readSession(id: string | undefined): OfficialSession | null {
  if (!id) return null;
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL) {
    store.delete(id);
    return null;
  }
  return entry.session;
}

export function destroySession(id: string | undefined): void {
  if (id) store.delete(id);
}

/** Reads the session for the incoming request, or null when signed out. */
export async function currentSession(): Promise<OfficialSession | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export async function currentSessionId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}
