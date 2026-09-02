import { readFileSync } from "node:fs";
import { login, getLeaguePlayers } from "../src/lib/fanta/official";

const s = await login(process.env.FC_USER!, process.env.FC_PASS!);
const players = await getLeaguePlayers(s.leagues[0], s.cookie);
const m = JSON.parse(readFileSync("/tmp/match.json", "utf8"));

for (const side of ["home", "away"] as const) {
  const t = m[side];
  console.log(`\n=== ${side}  team ${t.tid}  module ${t.mdl} -> ${t.nmdl}  total ${t.tot}  pts ${t.points} ===`);
  const show = (label: string, arr: Record<string, unknown>[]) => {
    console.log(` ${label}`);
    for (const p of arr) {
      const info = players.get(Number(p.pid));
      const counted = p.cscr !== 100;
      console.log(
        `   ${info?.role ?? "?"} ${(info?.name ?? String(p.pid)).padEnd(20)}` +
        ` voto ${String(p.scr === 56 ? "sv" : p.scr).padEnd(4)}` +
        ` counts ${counted ? String(p.cscr).padEnd(5) : "-    "}` +
        ` type ${p.ptype}`,
      );
    }
  };
  show("STARTERS", t.starts);
  show("BENCH", t.bench);
  const sum = [...t.starts, ...t.bench]
    .filter((p: Record<string, number>) => p.cscr !== 100)
    .reduce((a: number, p: Record<string, number>) => a + p.cscr, 0);
  console.log(` sum of counted scores: ${Math.round(sum * 100) / 100}   (reported total ${t.tot})`);
}
