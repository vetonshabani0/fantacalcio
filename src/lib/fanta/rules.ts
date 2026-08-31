import type { EventKind, Role } from "./types";

/**
 * Fantacalcio Classic ruleset.
 *
 * Every value here is configurable per league on leghe.fantacalcio.it, so the
 * defaults below are the conventional ones published by Fantacalcio for private
 * leagues. A league can override any of them.
 */
export interface Ruleset {
  bonus: Partial<Record<EventKind, number>>;
  /** Rating given to a player who played but received no vote, per role. null = treat as SV. */
  defaultGradeForNoVote: number | null;
  /** Fantapunti needed for the first goal. */
  firstGoalThreshold: number;
  /** Fantapunti between subsequent goals. */
  goalStep: number;
  /** Maximum automatic substitutions taken from the bench. */
  maxSubstitutions: number;
  /** Formations a manager may line up, as "DEF-MID-ATT". */
  formations: string[];
  defenseModifier: DefenseModifier;
}

export interface DefenseModifier {
  enabled: boolean;
  /** Include the goalkeeper's rating in the average. */
  includeGoalkeeper: boolean;
  /** How many defenders feed the average (best N by rating). */
  defendersCounted: number;
  /** Minimum rated defenders required for the modifier to apply at all. */
  minRatedDefenders: number;
  /** Ascending thresholds: the highest entry whose `from` is <= average applies. */
  bands: { from: number; points: number }[];
}

export const DEFAULT_RULES: Ruleset = {
  bonus: {
    scoredGoals: 3,
    scoredPenalties: 3,
    missedPenalties: -3,
    savedPenalties: 3,
    ownGoals: -2,
    assists: 1,
    softAssists: 0.5,
    goldAssists: 1,
    yellowCards: -0.5,
    redCards: -1,
    concededGoals: -1,
    cleanSheets: 0,
  },
  defaultGradeForNoVote: null,
  firstGoalThreshold: 66,
  goalStep: 6,
  maxSubstitutions: 3,
  formations: [
    "3-4-3",
    "3-5-2",
    "4-3-3",
    "4-4-2",
    "4-5-1",
    "5-3-2",
    "5-4-1",
    "3-4-2-1",
    "4-2-3-1",
  ],
  defenseModifier: {
    enabled: true,
    includeGoalkeeper: true,
    defendersCounted: 3,
    minRatedDefenders: 4,
    bands: [
      { from: 6, points: 1 },
      { from: 6.5, points: 3 },
      { from: 7, points: 6 },
      { from: 7.5, points: 8 },
    ],
  },
};

/** Human-readable labels for the events we surface in the UI. */
export const EVENT_LABEL: Record<EventKind, string> = {
  scoredGoals: "Gol",
  scoredPenalties: "Rigore segnato",
  missedPenalties: "Rigore sbagliato",
  savedPenalties: "Rigore parato",
  concededGoals: "Gol subito",
  ownGoals: "Autogol",
  assists: "Assist",
  softAssists: "Assist da fermo",
  goldAssists: "Assist d'oro",
  yellowCards: "Ammonizione",
  redCards: "Espulsione",
  cleanSheets: "Porta inviolata",
  decisiveGoals: "Gol decisivo",
  equalisingGoals: "Gol del pareggio",
  goalContributions: "Partecipazione al gol",
  manOfTheMatch: "Migliore in campo",
  subbedOut: "Sostituito",
  subbedIn: "Subentrato",
  varDisallowedGoals: "Gol annullato dal VAR",
  injuries: "Infortunio",
};

/** Compact glyphs used on the live board. */
export const EVENT_GLYPH: Partial<Record<EventKind, string>> = {
  scoredGoals: "⚽",
  scoredPenalties: "⚽",
  missedPenalties: "✖",
  savedPenalties: "🧤",
  concededGoals: "▽",
  ownGoals: "⊘",
  assists: "🅰",
  softAssists: "🅰",
  goldAssists: "🅰",
  yellowCards: "▮",
  redCards: "▮",
  manOfTheMatch: "★",
  subbedOut: "▼",
  subbedIn: "▲",
  varDisallowedGoals: "⌀",
  injuries: "✚",
};

/** Events that never carry points but are worth showing. */
export const INFORMATIONAL_EVENTS: EventKind[] = [
  "subbedIn",
  "subbedOut",
  "manOfTheMatch",
  "varDisallowedGoals",
  "injuries",
  "decisiveGoals",
  "equalisingGoals",
  "goalContributions",
];

export function parseFormation(formation: string): Record<Role, number> {
  const parts = formation.split("-").map(Number);
  const def = parts[0] ?? 4;
  const att = parts[parts.length - 1] ?? 3;
  const mid = parts.slice(1, -1).reduce((a, b) => a + b, 0);
  return { P: 1, D: def, C: mid, A: att };
}
