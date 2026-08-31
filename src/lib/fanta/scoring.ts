import { DEFAULT_RULES, parseFormation, type Ruleset } from "./rules";
import type { EventKind, LivePlayer, LiveSnapshot, Role } from "./types";

export interface ScoredPlayer {
  player: LivePlayer;
  /** Raw rating actually used (may come from the league's no-vote default). */
  grade: number | null;
  /** Sum of bonus/malus applied. */
  bonus: number;
  /** grade + bonus, or null when the player has no vote. */
  fantavoto: number | null;
  /** Itemised contributions, for the breakdown popover. */
  breakdown: { kind: EventKind; count: number; points: number }[];
  hasVote: boolean;
}

export function scorePlayer(
  player: LivePlayer,
  rules: Ruleset = DEFAULT_RULES,
): ScoredPlayer {
  const breakdown: { kind: EventKind; count: number; points: number }[] = [];
  let bonus = 0;

  for (const [kind, count] of Object.entries(player.counts) as [
    EventKind,
    number,
  ][]) {
    const unit = rules.bonus[kind];
    if (!unit) continue;
    const points = unit * count;
    bonus += points;
    breakdown.push({ kind, count, points });
  }
  breakdown.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  const grade = player.grade ?? rules.defaultGradeForNoVote;
  const hasVote = grade != null;

  return {
    player,
    grade,
    bonus: round2(bonus),
    fantavoto: hasVote ? round2(grade + bonus) : null,
    breakdown,
    hasVote,
  };
}

/** A manager's submitted lineup for one matchweek. */
export interface Lineup {
  formation: string;
  /** Player ids, in role order. */
  starters: number[];
  /** Player ids, in the order the manager wants them to come in. */
  bench: number[];
}

export interface SlotResult {
  role: Role;
  /** The player originally fielded in this slot. */
  starter: ScoredPlayer;
  /** Set when the bench engine swapped someone in. */
  substitute: ScoredPlayer | null;
  /** The player whose fantavoto actually counts. */
  counted: ScoredPlayer;
  /** True when this slot contributes nothing (no vote and no valid replacement). */
  void: boolean;
}

export interface TeamScore {
  slots: SlotResult[];
  /** Bench players that were not used. */
  unusedBench: ScoredPlayer[];
  substitutionsUsed: number;
  /** Sum of the eleven counted fantavoti. */
  baseTotal: number;
  defenseModifier: number;
  /** The average that drove the defense modifier, when it applied. */
  defenseAverage: number | null;
  /** baseTotal + modifiers. */
  total: number;
  goals: number;
  /** Fantapunti still needed for one more goal. */
  pointsToNextGoal: number;
  /** How many of the eleven slots have a settled vote. */
  ratedSlots: number;
}

/**
 * Applies the official Classic substitution rules.
 *
 * Slots without a vote are filled from the bench, in the manager's bench order,
 * by the first available player of the same role who does have a vote. The
 * league's substitution cap is respected; slots that cannot be filled are void.
 */
export function scoreTeam(
  lineup: Lineup,
  snapshot: LiveSnapshot,
  rules: Ruleset = DEFAULT_RULES,
): TeamScore {
  const resolve = (id: number): ScoredPlayer | null => {
    const p = snapshot.byId[id];
    return p ? scorePlayer(p, rules) : null;
  };

  const starters = lineup.starters
    .map(resolve)
    .filter((p): p is ScoredPlayer => p != null);
  const bench = lineup.bench
    .map(resolve)
    .filter((p): p is ScoredPlayer => p != null);

  const usedBench = new Set<number>();
  let substitutionsUsed = 0;

  const slots: SlotResult[] = starters.map((starter) => {
    const role = starter.player.role;
    if (starter.hasVote) {
      return { role, starter, substitute: null, counted: starter, void: false };
    }

    if (substitutionsUsed >= rules.maxSubstitutions) {
      return { role, starter, substitute: null, counted: starter, void: true };
    }

    const replacement = bench.find(
      (b) =>
        !usedBench.has(b.player.id) &&
        b.player.role === role &&
        b.hasVote,
    );

    if (!replacement) {
      return { role, starter, substitute: null, counted: starter, void: true };
    }

    usedBench.add(replacement.player.id);
    substitutionsUsed++;
    return {
      role,
      starter,
      substitute: replacement,
      counted: replacement,
      void: false,
    };
  });

  const counted = slots.filter((s) => !s.void);
  const baseTotal = round2(
    counted.reduce((sum, s) => sum + (s.counted.fantavoto ?? 0), 0),
  );

  const { points: defenseModifier, average: defenseAverage } =
    computeDefenseModifier(slots, rules);

  const total = round2(baseTotal + defenseModifier);
  const goals = goalsFor(total, rules);
  const nextThreshold =
    rules.firstGoalThreshold + goals * rules.goalStep;

  return {
    slots,
    unusedBench: bench.filter((b) => !usedBench.has(b.player.id)),
    substitutionsUsed,
    baseTotal,
    defenseModifier,
    defenseAverage,
    total,
    goals,
    pointsToNextGoal: round2(Math.max(0, nextThreshold - total)),
    ratedSlots: counted.length,
  };
}

/**
 * Defense modifier: average the goalkeeper's rating with the best N defenders'
 * ratings, bonuses excluded, then look the average up in the league's bands.
 * Requires a minimum number of rated defenders to apply at all.
 */
function computeDefenseModifier(
  slots: SlotResult[],
  rules: Ruleset,
): { points: number; average: number | null } {
  const mod = rules.defenseModifier;
  if (!mod.enabled) return { points: 0, average: null };

  const ratedIn = (role: Role) =>
    slots
      .filter((s) => !s.void && s.counted.player.role === role)
      .map((s) => s.counted.grade)
      .filter((g): g is number => g != null);

  const defenders = ratedIn("D").sort((a, b) => b - a);
  if (defenders.length < mod.minRatedDefenders) {
    return { points: 0, average: null };
  }

  const values = defenders.slice(0, mod.defendersCounted);
  if (mod.includeGoalkeeper) {
    const keepers = ratedIn("P");
    if (keepers.length === 0) return { points: 0, average: null };
    values.push(keepers[0]);
  }
  if (values.length === 0) return { points: 0, average: null };

  const average = values.reduce((a, b) => a + b, 0) / values.length;

  let points = 0;
  for (const band of mod.bands) {
    if (average >= band.from) points = band.points;
  }
  return { points, average: round2(average) };
}

export function goalsFor(total: number, rules: Ruleset = DEFAULT_RULES): number {
  if (total < rules.firstGoalThreshold) return 0;
  return 1 + Math.floor((total - rules.firstGoalThreshold) / rules.goalStep);
}

/** Validates that a lineup's starters match its declared formation. */
export function lineupErrors(
  lineup: Lineup,
  playerRole: (id: number) => Role | null,
): string[] {
  const need = parseFormation(lineup.formation);
  const have: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const id of lineup.starters) {
    const role = playerRole(id);
    if (role) have[role]++;
  }
  const errors: string[] = [];
  for (const role of ["P", "D", "C", "A"] as Role[]) {
    if (have[role] !== need[role]) {
      errors.push(
        `Il modulo ${lineup.formation} richiede ${need[role]} ${role}, ne hai ${have[role]}.`,
      );
    }
  }
  if (lineup.starters.length !== 11) {
    errors.push(`Servono 11 titolari, ne hai ${lineup.starters.length}.`);
  }
  return errors;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
