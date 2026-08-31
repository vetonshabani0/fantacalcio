import { resolvePointer, getCurrentSnapshot, clubsOf, getPlayerIndex } from "../src/lib/fanta/source";
import { scorePlayer } from "../src/lib/fanta/scoring";

const t0 = Date.now();
const p = await resolvePointer();
console.log("pointer", p, `${Date.now() - t0}ms`);

const snap = await getCurrentSnapshot();
if (!snap) throw new Error("no snapshot");
console.log("matches", snap.matches.length, "players", snap.players.length);
console.log(snap.matches.map((m) => `${m.homeTeamName} ${m.homeGoals}-${m.awayGoals} ${m.awayTeamName} [${m.state}]`).join("\n"));
console.log("clubs", clubsOf(snap).length);

const scored = snap.players.map((pl) => scorePlayer(pl)).filter((s) => s.hasVote);
scored.sort((a, b) => (b.fantavoto ?? 0) - (a.fantavoto ?? 0));
console.log("\nTop 8 fantavoto:");
for (const s of scored.slice(0, 8)) {
  console.log(
    ` ${s.player.name} (${s.player.role}, ${s.player.teamName}) voto ${s.grade} bonus ${s.bonus} => ${s.fantavoto}`,
    s.breakdown.map((b) => `${b.kind}x${b.count}=${b.points}`).join(" "),
  );
}

const subs = snap.players.filter((pl) => pl.replacedPlayerId);
console.log("\nSubstitutions detected:", subs.length);
for (const s of subs.slice(0, 5)) {
  const out = snap.byId[s.replacedPlayerId!];
  const min = s.events.find((e) => e.kind === "subbedIn")?.minute;
  console.log(` ${min}' IN ${s.name} <- OUT ${out?.name ?? "?"} (${s.teamName})`);
}

const idx = await getPlayerIndex();
console.log("\nplayer index size", idx.length);
