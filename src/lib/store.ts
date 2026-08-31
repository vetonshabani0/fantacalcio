import { promises as fs } from "node:fs";
import path from "node:path";
import type { League } from "./fanta/league";

/**
 * Leagues live as one JSON file each under .data/leagues. That keeps the app
 * dependency-free while still letting a league be shared by its code.
 */
const ROOT = path.join(process.cwd(), ".data", "leagues");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function ensureRoot(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

function fileFor(code: string): string {
  return path.join(ROOT, `${normalizeCode(code)}.json`);
}

export async function saveLeague(league: League): Promise<League> {
  await ensureRoot();
  const next = { ...league, updatedAt: Date.now() };
  await fs.writeFile(fileFor(next.code), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function loadLeague(code: string): Promise<League | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  try {
    const raw = await fs.readFile(fileFor(normalized), "utf8");
    return JSON.parse(raw) as League;
  } catch {
    return null;
  }
}

export async function listLeagues(): Promise<League[]> {
  await ensureRoot();
  const files = await fs.readdir(ROOT).catch(() => [] as string[]);
  const leagues: League[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const league = await loadLeague(file.replace(/\.json$/, ""));
    if (league) leagues.push(league);
  }
  return leagues.sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface Match {
  league: League;
  teamId: string;
}

/**
 * Resolves whatever a user types on the entry screen: a league code, a fantasy
 * team name, or a manager's name.
 */
export async function findEntry(query: string): Promise<
  | { kind: "league"; league: League }
  | { kind: "team"; league: League; teamId: string }
  | { kind: "ambiguous"; matches: Match[] }
  | { kind: "none" }
> {
  const trimmed = query.trim();
  if (!trimmed) return { kind: "none" };

  const byCode = await loadLeague(trimmed);
  if (byCode) return { kind: "league", league: byCode };

  const needle = trimmed.toLowerCase();
  const leagues = await listLeagues();
  const matches: Match[] = [];

  for (const league of leagues) {
    if (league.name.toLowerCase() === needle) {
      return { kind: "league", league };
    }
    for (const team of league.teams) {
      if (
        team.name.toLowerCase().includes(needle) ||
        team.manager.toLowerCase().includes(needle)
      ) {
        matches.push({ league, teamId: team.id });
      }
    }
  }

  if (matches.length === 1) {
    return { kind: "team", league: matches[0].league, teamId: matches[0].teamId };
  }
  if (matches.length > 1) return { kind: "ambiguous", matches };
  return { kind: "none" };
}
