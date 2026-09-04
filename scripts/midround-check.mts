/**
 * Replays a finished matchweek as though it were still being played.
 *
 * The estimate is easy to check once a round is over and every player has a
 * rating — `check:estimate` does that. The harder question is how it behaves at
 * 21:00 on a Saturday, with two matches played and eight to come, which is
 * precisely when someone is looking at it.
 *
 * So: take the real feed for a settled round and rewind it to each kickoff in
 * turn. At every moment, matches that had not finished by then have their
 * ratings stripped and their state set back to pre-match — which is exactly what
 * the live file looks like at that instant — and the estimate is run against it.
 *
 * What the output should show: totals climbing monotonically towards the final
 * figure, `rated` rising to eleven per team, and substitutions churning in the
 * middle before settling at zero. A team sitting at `0.0/0` has not started, not
 * failed, which is why the live table labels that case rather than showing a
 * deficit.
 *
 *   npx tsx scripts/midround-check.mts [matchweek] [alias]
 */

import { decodeFeed, type RawFeed } from "../src/lib/fanta/decode";
import {
  fetchAllHistories,
  fetchPublicLeague,
} from "../src/lib/fanta/public-league";
import { estimateLive, serieAMatchweekFor } from "../src/lib/fanta/public-live";
import { resolvePointer } from "../src/lib/fanta/source";

const matchweek = Number(process.argv[2] ?? 2);
const alias = process.argv[3] ?? "shkupi-fantacalcio";

const league = await fetchPublicLeague(alias);
if (!league) {
  console.log(`Could not read '${alias}'.`);
  process.exit(1);
}

const pointer = await resolvePointer();
const serieA = serieAMatchweekFor(league, matchweek);
const raw = (await fetch(
  `https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live/${pointer.seasonId}/live_${serieA}.json`,
)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)) as RawFeed | null;

if (!raw?.data?.pl?.length) {
  console.log(`Matchweek ${matchweek} has no ratings to rewind.`);
  process.exit(1);
}

const histories = await fetchAllHistories(league);
const kickoffs = [...new Set(raw.data.inc.map((m) => m.d))].sort();

console.log(
  `=== ${league.competitionName} — matchweek ${matchweek} ` +
    `(Serie A ${serieA}, ${raw.data.inc.length} matches over ${kickoffs.length} slots)\n`,
);
console.log(
  "  AT KICKOFF        " +
    league.teams.map((t) => t.name.slice(0, 9).padStart(10)).join("") +
    "   RATED  SUBS",
);

const moments: (string | null)[] = [...kickoffs, null];

for (const at of moments) {
  const feed: RawFeed = JSON.parse(JSON.stringify(raw));

  // Everything kicking off at or after this instant has not happened yet.
  const pending = new Set<number>();
  for (const match of feed.data!.inc) {
    if (at && match.d >= at) {
      match.sto = 0;
      match.g_a = 0;
      match.g_b = 0;
      pending.add(match.id_a);
      pending.add(match.id_b);
    }
  }
  for (const player of feed.data!.pl) {
    if (!pending.has(player.id_s)) continue;
    player.v = 56; // the feed's "no vote at all" sentinel
    player.bm = [];
    player.min = [];
    player.sto = 0;
    player.sp = 0;
  }

  const estimate = await estimateLive(
    league,
    decodeFeed(feed, pointer.seasonId, serieA),
    matchweek,
  );
  const byId = new Map(estimate.teams.map((t) => [t.teamId, t]));

  const cells = league.teams
    .map((team) => {
      const row = byId.get(team.id);
      return `${(row?.fantapoints ?? 0).toFixed(1)}/${row?.ratedSlots ?? 0}`.padStart(
        10,
      );
    })
    .join("");

  console.log(
    `  ${(at ? at.slice(5, 16).replace("T", " ") : "FINAL").padEnd(18)}${cells}` +
      `   ${String(estimate.teams.reduce((s, t) => s + t.ratedSlots, 0)).padStart(5)}` +
      `  ${String(estimate.teams.reduce((s, t) => s + t.substitutionsUsed, 0)).padStart(4)}`,
  );
}

const actual = league.teams
  .map((team) => {
    const row = histories.get(team.id)?.find((r) => r.matchweek === matchweek);
    return (row?.fantapoints ?? 0).toFixed(1).padStart(10);
  })
  .join("");
console.log(`\n  ${"AS THE LEAGUE SCORED IT".padEnd(18)}${actual}`);
