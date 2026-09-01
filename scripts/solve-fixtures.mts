import { fetchHistory, fetchPublicLeague } from "../src/lib/fanta/public-league";

const league = await fetchPublicLeague("shkupi-fantacalcio");
if (!league) throw new Error("no league");

// Goals from fantapoints: first goal at 66, then one every 6.
const goalsOf = (fp: number) => (fp < 66 ? 0 : 1 + Math.floor((fp - 66) / 6));

const ids = league.teams.map((t) => t.id);
const nameOf = new Map(league.teams.map((t) => [t.id, t.name]));
const other = (id: number) => ids.find((x) => x !== id)!;

// Per-team, per-matchweek fantapoints and result sign.
const hist = new Map<number, { mw: number; fp: number; res: string }[]>();
for (const id of ids) {
  const h = await fetchHistory(league.leagueId, league.competitionId, id, other(id));
  hist.set(id, (h?.a.rows ?? []).filter((r) => r.settled).map((r) => ({ mw: r.matchweek, fp: r.fantapoints, res: r.result })));
}

const weeks = [...new Set([...hist.values()].flat().map((r) => r.mw))].sort((a, b) => a - b);
console.log("settled matchweeks:", weeks.join(", "));

/** All perfect matchings of a team list. */
function matchings(list: number[]): [number, number][][] {
  if (list.length === 0) return [[]];
  const [first, ...rest] = list;
  const out: [number, number][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const pair: [number, number] = [first, rest[i]];
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of matchings(remaining)) out.push([pair, ...sub]);
  }
  return out;
}

// Candidate pairings per matchweek: those consistent with every result sign.
const perWeek = weeks.map((mw) => {
  const fp = new Map(ids.map((id) => [id, hist.get(id)!.find((r) => r.mw === mw)!]));
  const valid = matchings(ids).filter((m) =>
    m.every(([a, b]) => {
      const ga = goalsOf(fp.get(a)!.fp), gb = goalsOf(fp.get(b)!.fp);
      const ra = fp.get(a)!.res, rb = fp.get(b)!.res;
      if (ga > gb) return ra === "V" && rb === "P";
      if (ga < gb) return ra === "P" && rb === "V";
      return ra === "N" && rb === "N";
    }),
  );
  return { mw, valid, fp };
});

for (const w of perWeek) {
  console.log(`  MW${w.mw}: ${w.valid.length} pairing(s) consistent with the result signs alone`);
}

// Now constrain with cumulative goals conceded: gs = sum of opponents' goals.
const gsTarget = new Map(league.teams.map((t) => [t.id, t.goalsAgainst]));

const key = (a: number, b: number) => [a, b].sort().join("-");

function search(i: number, conceded: Map<number, number>, chosen: [number, number][][], used: Set<string>): [number, number][][][] {
  if (i === perWeek.length) {
    return ids.every((id) => conceded.get(id) === gsTarget.get(id)) ? [chosen] : [];
  }
  const out: [number, number][][][] = [];
  for (const m of perWeek[i].valid) {
    // A round-robin never repeats a pairing inside the same round.
    if (m.some(([a, b]) => used.has(key(a, b)))) continue;
    const nextUsed = new Set(used);
    for (const [a, b] of m) nextUsed.add(key(a, b));
    const next = new Map(conceded);
    for (const [a, b] of m) {
      const ga = goalsOf(perWeek[i].fp.get(a)!.fp), gb = goalsOf(perWeek[i].fp.get(b)!.fp);
      next.set(a, (next.get(a) ?? 0) + gb);
      next.set(b, (next.get(b) ?? 0) + ga);
    }
    out.push(...search(i + 1, next, [...chosen, m], nextUsed));
  }
  return out;
}

const solutions = search(0, new Map(ids.map((id) => [id, 0])), [], new Set());
console.log(`\nsolutions matching every team's goals-conceded total: ${solutions.length}`);

if (solutions.length >= 1) {
  console.log(solutions.length === 1 ? "UNIQUE — the real calendar is recoverable:\n" : "first candidate:\n");
  solutions[0].forEach((m, i) => {
    console.log(`  Matchweek ${weeks[i]}`);
    for (const [a, b] of m) {
      const fa = perWeek[i].fp.get(a)!.fp, fb = perWeek[i].fp.get(b)!.fp;
      console.log(`    ${nameOf.get(a)!.padEnd(28)} ${goalsOf(fa)} - ${goalsOf(fb)}  ${nameOf.get(b)}   (${fa} vs ${fb})`);
    }
  });
}
