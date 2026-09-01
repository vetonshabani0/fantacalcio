import { fetchPublicLeague, searchLeagues } from "../src/lib/fanta/public-league";

console.log("=== search by name: 'Shkupi' ===");
const found = await searchLeagues("Shkupi");
console.log("  aliases found:", found.join(", ") || "none");

const alias = found[0] ?? "shkupi-fantacalcio";
console.log(`\n=== reading '${alias}' with NO login ===`);
const t0 = Date.now();
const league = await fetchPublicLeague(alias);
if (!league) {
  console.log("  could not read");
  process.exit(1);
}

console.log(`  ${league.competitionName}  (league ${league.leagueId}, competition ${league.competitionId})`);
console.log(`  president: ${league.president}   matchweeks ${league.firstMatchweek}-${league.lastMatchweek}`);
console.log(`  fetched in ${Date.now() - t0}ms\n`);

console.log("  #  TEAM                       P   Pt   W-D-L    GF:GA   DIFF   FANTAPTS  LOGO");
for (const t of league.teams) {
  console.log(
    `  ${String(t.position).padStart(2)}  ${t.name.padEnd(26).slice(0, 26)} ` +
      `${String(t.played).padStart(2)}  ${String(t.points).padStart(3)}  ` +
      `${`${t.won}-${t.drawn}-${t.lost}`.padEnd(7)}  ` +
      `${`${t.goalsFor}:${t.goalsAgainst}`.padEnd(6)}  ` +
      `${String(t.goalDifference).padStart(3)}   ` +
      `${String(t.fantapoints).padStart(7)}   ${t.logo ? "yes" : "-"}`,
  );
}
