import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { OfficialSession } from "./fanta/official";

/**
 * Stateless sessions, sealed into the cookie itself.
 *
 * An in-memory store cannot work on serverless hosting: each request may land
 * in a different (or cold) instance, so a session written by the login route
 * would frequently be invisible to the next call, and the user would appear to
 * be logged out at random. Sealing the session into an encrypted httpOnly
 * cookie makes it travel with the request instead, which behaves identically on
 * a laptop and on a serverless platform.
 *
 * The payload holds the account's league tokens, so it is encrypted with
 * AES-256-GCM and never merely signed. The password is never part of it.
 */

const COOKIE_PREFIX = "fl_s";
const MAX_CHUNKS = 8;
/** Well under the ~4096-byte per-cookie limit, leaving room for attributes. */
const CHUNK_SIZE = 3200;
const MAX_AGE = 8 * 60 * 60;

function secret(): Buffer {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.length >= 16) {
    return createHash("sha256").update(raw).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set in production: it encrypts the league tokens held in the session cookie.",
    );
  }
  // Development fallback: stable for this process, so edits do not log you out.
  const scope = globalThis as unknown as { __flDevSecret?: Buffer };
  scope.__flDevSecret ??= randomBytes(32);
  return scope.__flDevSecret;
}

export function seal(session: OfficialSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal(value: string): OfficialSession | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      secret(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(text) as OfficialSession;
  } catch {
    // Wrong key, tampered payload, or an old cookie after a secret rotation.
    return null;
  }
}

/** Writes the sealed session across as many cookies as it needs. */
export function writeSession(
  response: NextResponse,
  session: OfficialSession,
): void {
  const sealed = seal(session);
  const chunks: string[] = [];
  for (let i = 0; i < sealed.length; i += CHUNK_SIZE) {
    chunks.push(sealed.slice(i, i + CHUNK_SIZE));
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error("Sessione troppo grande per essere salvata nei cookie.");
  }

  chunks.forEach((chunk, i) => {
    response.cookies.set(`${COOKIE_PREFIX}${i}`, chunk, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
  });

  // Clear any leftovers from a previous, longer session.
  for (let i = chunks.length; i < MAX_CHUNKS; i++) {
    response.cookies.set(`${COOKIE_PREFIX}${i}`, "", { path: "/", maxAge: 0 });
  }
}

export function clearSession(response: NextResponse): void {
  for (let i = 0; i < MAX_CHUNKS; i++) {
    response.cookies.set(`${COOKIE_PREFIX}${i}`, "", { path: "/", maxAge: 0 });
  }
}

/** Reassembles and decrypts the session for the incoming request. */
export async function currentSession(): Promise<OfficialSession | null> {
  const jar = await cookies();
  let joined = "";
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = jar.get(`${COOKIE_PREFIX}${i}`)?.value;
    if (!part) break;
    joined += part;
  }
  return joined ? unseal(joined) : null;
}
