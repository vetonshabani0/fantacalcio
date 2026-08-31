import { buildCalendar, type League, type Team } from "./fanta/league";
import { DEFAULT_RULES } from "./fanta/rules";
import { getPlayerIndex, resolvePointer } from "./fanta/source";
import type { LivePlayer, Role } from "./fanta/types";
import { generateCode } from "./store";

const TEAM_NAMES = [
  "Real Fenomeni",
  "Panchina Lunga",
  "Modulo Zero",
  "Bomber di Provincia",
  "Difesa Colabrodo",
  "I Rigoristi",
  "Malus United",
  "Sliding Doors",
  "Fantacalcio Anonima",
  "Zona Cesarini",
];

const MANAGERS = [
  "Luca",
  "Giulia",
  "Marco",
  "Sara",
  "Andrea",
  "Chiara",
  "Matteo",
  "Elena",
  "Davide",
  "Federica",
];

/** Roster shape used by the demo draft: 3 P, 8 D, 8 C, 6 A. */
const ROSTER_SHAPE: Record<Role, number> = { P: 3, D: 8, C: 8, A: 6 };

/**
 * Builds a ready-to-watch league by snake-drafting real Serie A players, so the
 * app has something live to show without anyone entering a roster first.
 */
export async function buildDemoLeague(teamCount = 8): Promise<League> {
  const pointer = await resolvePointer();
  const index = await getPlayerIndex();

  const pools: Record<Role, LivePlayer[]> = { P: [], D: [], C: [], A: [] };
  for (const player of index) pools[player.role].push(player);

  // Draft regular starters first, the way a real auction plays out. Ordering by
  // rating instead would hand every demo team an unrealistically perfect week.
  for (const role of Object.keys(pools) as Role[]) {
    pools[role].sort(
      (a, b) =>
        b.startProbability - a.startProbability ||
        a.lineupPosition - b.lineupPosition ||
        a.name.localeCompare(b.name),
    );
  }

  const size = Math.max(2, Math.min(teamCount, TEAM_NAMES.length));
  const teams: Team[] = Array.from({ length: size }, (_, i) => ({
    id: `t${i + 1}`,
    name: TEAM_NAMES[i],
    manager: MANAGERS[i],
    roster: [],
  }));

  for (const role of ["P", "D", "C", "A"] as Role[]) {
    const pool = pools[role];
    let cursor = 0;
    for (let round = 0; round < ROSTER_SHAPE[role]; round++) {
      // Snake order keeps the draft fair across rounds.
      const order = round % 2 === 0 ? teams : [...teams].reverse();
      for (const team of order) {
        const pick = pool[cursor++];
        if (pick) team.roster.push(pick.id);
      }
    }
  }

  const now = Date.now();
  return {
    code: generateCode(),
    name: "Lega Dimostrativa",
    createdAt: now,
    updatedAt: now,
    seasonId: pointer.seasonId,
    startMatchweek: 1,
    rules: DEFAULT_RULES,
    teams,
    fixtures: buildCalendar(teams),
    lineups: {},
  };
}
