/**
 * Measures how close the credential-free live estimate gets to reality.
 *
 * The estimate rebuilds each team's score from its public roster and the Serie A
 * feed, guessing the eleven the manager fielded. For a settled matchweek the
 * league itself publishes what every team actually scored, so the two can be put
 * side by side — which is the only honest way to say how good the guess is.
 *
 * One caveat on the historical figures: the season averages that break ties when
 * picking the eleven are read as they stand today, so for a matchweek already
 * played they include that matchweek. A live estimate has no such advantage —
 * an uncalculated matchweek is not yet in anyone's average — so the errors below
 * flatter the estimator slightly.
 *
 *   npx tsx scripts/public-live-check.mts [alias] [matchweek]
 */

import { estimateLive, serieAMatchweekFor } from "../src/lib/fanta/public-live";
import {
  fetchAllHistories,
  fetchPublicLeague,
} from "../src/lib/fanta/public-league";
import { getSnapshot, resolvePointer } from "../src/lib/fanta/source";

const alias = process.argv[2] ?? "shkupi-fantacalcio";
const requested = Number(process.argv[3]);

const league = await fetchPublicLeague(alias);
if (!league) {
  console.log(`Could not read '${alias}' without signing in.`);
  process.exit(1);
}

console.log(`=== ${league.competitionName} (${alias}) ===`);
console.log(
  `  ${league.teams.length} teams · current matchweek ${league.currentMatchweek} ` +
    `· Serie A start ${league.serieAStart}`,
);
console.log(
  `  managers: ${league.teams.map((t) => t.manager || "?").join(", ")}\n`,
);

const histories = await fetchAllHistories(league);
const lastSettled = Math.max(
  0,
  ...[...histories.values()].flatMap((rows) =>
    rows.filter((r) => r.settled).map((r) => r.matchweek),
  ),
);

const matchweek = Number.isFinite(requested) ? requested : lastSettled;
const serieA = serieAMatchweekFor(league, matchweek);
const pointer = await resolvePointer();
const snapshot = await getSnapshot(pointer.seasonId, serieA);

if (!snapshot) {
  console.log(`No Serie A feed for matchweek ${serieA}.`);
  process.exit(1);
}

const t0 = Date.now();
const estimate = await estimateLive(league, snapshot, matchweek);
console.log(
  `=== matchweek ${matchweek} (Serie A ${serieA}) — estimated in ${Date.now() - t0}ms\n`,
);

if (estimate.missing.length) {
  console.log(`  squads unreadable for ${estimate.missing.length} team(s)\n`);
}

const settled = matchweek <= lastSettled;
console.log(
  `  TEAM                       MODULE   ESTIMATE  ${settled ? "  ACTUAL     DIFF" : ""}`,
);

let worst = 0;
let sum = 0;
let counted = 0;

for (const team of estimate.teams) {
  const actual = histories
    .get(team.teamId)
    ?.find((r) => r.matchweek === matchweek && r.settled);

  let tail = "";
  if (actual) {
    const diff = team.fantapoints - actual.fantapoints;
    worst = Math.max(worst, Math.abs(diff));
    sum += Math.abs(diff);
    counted++;
    tail =
      `  ${actual.fantapoints.toFixed(2).padStart(8)}  ` +
      `${(diff >= 0 ? "+" : "") + diff.toFixed(2)}`;
  }

  console.log(
    `  ${team.name.padEnd(26).slice(0, 26)} ${team.formation.padEnd(8)} ` +
      `${team.fantapoints.toFixed(2).padStart(8)}${tail}`,
  );
}

if (counted) {
  console.log(
    `\n  mean absolute error ${(sum / counted).toFixed(2)} fantapunti, ` +
      `worst ${worst.toFixed(2)}`,
  );
}

const leader = estimate.teams[0];
if (leader) {
  console.log(`\n=== ${leader.name}: ${leader.formation}`);
  for (const p of leader.players) {
    const value = p.void
      ? "void"
      : p.fantavoto != null
        ? p.fantavoto.toFixed(2)
        : "—";
    console.log(
      `  ${p.role}  ${p.name.padEnd(18).slice(0, 18)} ${p.club.padEnd(12).slice(0, 12)} ` +
        `${value.padStart(6)}${p.cameOnFor ? `   (for ${p.cameOnFor})` : ""}`,
    );
  }
  console.log(
    `  ${" ".repeat(35)}modifier ${leader.defenseModifier >= 0 ? "+" : ""}${leader.defenseModifier}` +
      `  total ${leader.fantapoints}  → ${leader.goals} gol`,
  );
}
