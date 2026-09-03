/**
 * Shows the league table as it would stand mid-round, both ways.
 *
 * Run against a settled matchweek it doubles as a correctness check: rebuild the
 * round from the public squads, fold it into the table as it stood before, and
 * compare with the table the league itself published afterwards.
 *
 *   npx tsx scripts/live-table-check.mts [alias] [matchweek]
 */

import { buildLiveTable } from "../src/lib/fanta/live-table";
import {
  buildMatchweekView,
  fetchAllHistories,
  fetchPublicLeague,
} from "../src/lib/fanta/public-league";
import { estimateLive, serieAMatchweekFor } from "../src/lib/fanta/public-live";
import { getSnapshot, resolvePointer } from "../src/lib/fanta/source";

const alias = process.argv[2] ?? "shkupi-fantacalcio";
const requested = Number(process.argv[3]);

const league = await fetchPublicLeague(alias);
if (!league) {
  console.log(`Could not read '${alias}'.`);
  process.exit(1);
}

const histories = await fetchAllHistories(league);
const lastSettled = Math.max(
  0,
  ...[...histories.values()].flatMap((rows) =>
    rows.filter((r) => r.settled).map((r) => r.matchweek),
  ),
);

const matchweek = Number.isFinite(requested) ? requested : lastSettled;
const pointer = await resolvePointer();
const snapshot = await getSnapshot(
  pointer.seasonId,
  serieAMatchweekFor(league, matchweek),
);
if (!snapshot || snapshot.players.length === 0) {
  console.log(`No Serie A ratings published for matchweek ${matchweek} yet.`);
  process.exit(1);
}

const estimate = await estimateLive(league, snapshot, matchweek);

// The table as it stood before this round: everything settled up to the one
// before it.
const before = buildMatchweekView(league, histories, matchweek - 1).tableAfter;

console.log(`=== ${league.competitionName} — matchweek ${matchweek}\n`);

for (const withFixtures of [false, true]) {
  // Without a real calendar, pair the round off arbitrarily to exercise the
  // exact path: this is a shape check, not a claim about who played whom.
  const ids = league.teams.map((t) => t.id);
  const fixtures = withFixtures
    ? ids
        .filter((_, i) => i % 2 === 0)
        .map((home, i) => ({
          matchweek,
          homeTeamId: home,
          awayTeamId: ids[i * 2 + 1],
        }))
        .filter((f) => f.awayTeamId != null)
    : null;

  const table = buildLiveTable(before, estimate.teams, fixtures, matchweek);

  console.log(
    withFixtures
      ? "--- with fixtures (exact points, illustrative pairings)"
      : "--- without fixtures (points frozen, fantapoints live)",
  );
  console.log(`    exact=${table.exact}`);
  console.log(
    "     #  TEAM                        ROUND   TOTFP   PT  MOVE  VERDICT",
  );
  for (const row of table.rows) {
    const r = row.round;
    const verdict = !r
      ? ""
      : r.opponent
        ? r.toLead === 0
          ? `leads by ${Math.abs(r.margin ?? 0).toFixed(1)} vs ${r.opponent.name.slice(0, 12)}`
          : `needs ${r.toLead?.toFixed(1)} vs ${r.opponent.name.slice(0, 12)}`
        : `${r.toNextGoal.toFixed(1)} to next goal`;
    console.log(
      `    ${String(row.position).padStart(2)}  ${row.name.padEnd(26).slice(0, 26)} ` +
        `${(r?.fantapoints ?? 0).toFixed(1).padStart(6)} ` +
        `${row.fantapoints.toFixed(1).padStart(7)} ` +
        `${String(row.points).padStart(4)}  ${row.movement.padEnd(5)} ${verdict}`,
    );
  }
  console.log();
}

// Ground truth: the league's own table after this matchweek.
const official = buildMatchweekView(league, histories, matchweek).tableAfter;

if (matchweek > lastSettled) process.exit(0);

/*
 * Does the table maths itself hold up?
 *
 * The comparison above mixes two things: how well the round was guessed, and
 * whether folding a round into a table is done correctly. This separates them.
 * Feed `buildLiveTable` the figures the league actually published for the round
 * instead of the estimate, pair the teams off in any way consistent with those
 * published results, and the output must reproduce the official table exactly.
 */
const goalsOf = (fp: number) => (fp < 66 ? 0 : 1 + Math.floor((fp - 66) / 6));

const published = league.teams
  .map((team) => {
    const row = histories.get(team.id)?.find((r) => r.matchweek === matchweek);
    return row ? { team, row } : null;
  })
  .filter((x) => x != null);

/** Any pairing whose signs and goals agree with what was published. */
function consistentPairing(
  pool: typeof published,
): { homeTeamId: number; awayTeamId: number; matchweek: number }[] | null {
  if (pool.length === 0) return [];
  const [first, ...rest] = pool;
  for (let i = 0; i < rest.length; i++) {
    const other = rest[i];
    const a = goalsOf(first.row.fantapoints);
    const b = goalsOf(other.row.fantapoints);
    const ok =
      a === b
        ? first.row.points === 1 && other.row.points === 1
        : a > b
          ? first.row.points === 3 && other.row.points === 0
          : first.row.points === 0 && other.row.points === 3;
    if (!ok) continue;
    const tail = consistentPairing([
      ...rest.slice(0, i),
      ...rest.slice(i + 1),
    ]);
    if (tail) {
      return [
        {
          matchweek,
          homeTeamId: first.team.id,
          awayTeamId: other.team.id,
        },
        ...tail,
      ];
    }
  }
  return null;
}

const pairing = consistentPairing(published);
if (!pairing) {
  console.log("--- no pairing consistent with the published results; skipping");
  process.exit(0);
}

const asRound = published.map(({ team, row }) => ({
  teamId: team.id,
  name: team.name,
  logo: team.logo,
  manager: team.manager,
  formation: "",
  fantapoints: row.fantapoints,
  goals: goalsOf(row.fantapoints),
  defenseModifier: 0,
  substitutionsUsed: 0,
  ratedSlots: 11,
  pointsToNextGoal: 0,
  players: [],
  bench: [],
}));

const rebuilt = buildLiveTable(before, asRound, pairing, matchweek);

console.log("--- table maths, fed the published figures instead of the estimate");
let mismatches = 0;
for (const row of rebuilt.rows) {
  const truth = official.find((o) => o.teamId === row.teamId)!;
  const bad =
    row.points !== truth.points ||
    Math.abs(row.fantapoints - truth.fantapoints) > 0.01 ||
    row.won !== truth.won ||
    row.drawn !== truth.drawn ||
    row.lost !== truth.lost ||
    row.position !== truth.position;
  if (bad) mismatches++;
  console.log(
    `    ${String(row.position).padStart(2)}  ${row.name.padEnd(26).slice(0, 26)} ` +
      `${row.fantapoints.toFixed(1).padStart(7)} ${String(row.points).padStart(4)}  ` +
      `${row.won}-${row.drawn}-${row.lost}   ` +
      (bad
        ? `MISMATCH (official: pos ${truth.position}, ${truth.fantapoints.toFixed(1)}, ` +
          `${truth.points}pt, ${truth.won}-${truth.drawn}-${truth.lost})`
        : "matches official"),
  );
}
console.log(
  mismatches === 0
    ? "\n    ✓ reproduces the league's own table exactly"
    : `\n    ✗ ${mismatches} row(s) differ from the official table`,
);
