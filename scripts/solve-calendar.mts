import { fetchHistory, fetchPublicLeague } from "../src/lib/fanta/public-league";

const league = await fetchPublicLeague("shkupi-fantacalcio");
if (!league) throw new Error("no league");

const goalsOf = (fp: number) => (fp < 66 ? 0 : 1 + Math.floor((fp - 66) / 6));
const ids = league.teams.map((t) => t.id);
const nameOf = new Map(league.teams.map((t) => [t.id, t.name]));
const other = (id: number) => ids.find((x) => x !== id)!;

const hist = new Map<number, Map<number, { fp: number; res: string }>>();
for (const id of ids) {
  const h = await fetchHistory(league.leagueId, league.competitionId, id, other(id));
  hist.set(id, new Map((h?.a.rows ?? []).filter((r) => r.settled).map((r) => [r.matchweek, { fp: r.fantapoints, res: r.result }])));
}
const weeks = [...new Set([...hist.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);

/** Circle-method round robin: the classic way a fixture list is generated. */
function circle(order: number[], rounds: number): [number, number][][] {
  const n = order.length;
  const half = n / 2;
  let arr = [...order];
  const cal: [number, number][][] = [];
  for (let r = 0; r < rounds; r++) {
    for (let w = 0; w < n - 1; w++) {
      const pairs: [number, number][] = [];
      for (let i = 0; i < half; i++) pairs.push([arr[i], arr[n - 1 - i]]);
      cal.push(pairs);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop()!);
      arr = [fixed, ...rest];
    }
    arr = [...order];
  }
  return cal;
}

function* permutations(list: number[]): Generator<number[]> {
  if (list.length <= 1) { yield list; return; }
  for (let i = 0; i < list.length; i++) {
    const rest = [...list.slice(0, i), ...list.slice(i + 1)];
    for (const p of permutations(rest)) yield [list[i], ...p];
  }
}

const gsTarget = new Map(league.teams.map((t) => [t.id, t.goalsAgainst]));

/** Does this schedule reproduce every settled matchweek exactly? */
function consistent(cal: [number, number][][]): boolean {
  const conceded = new Map(ids.map((id) => [id, 0]));
  for (const mw of weeks) {
    const pairs = cal[mw - 1];
    if (!pairs) return false;
    for (const [a, b] of pairs) {
      const ra = hist.get(a)?.get(mw), rb = hist.get(b)?.get(mw);
      if (!ra || !rb) return false;
      const ga = goalsOf(ra.fp), gb = goalsOf(rb.fp);
      const okA = ga > gb ? ra.res === "V" : ga < gb ? ra.res === "P" : ra.res === "N";
      const okB = gb > ga ? rb.res === "V" : gb < ga ? rb.res === "P" : rb.res === "N";
      if (!okA || !okB) return false;
      conceded.set(a, conceded.get(a)! + gb);
      conceded.set(b, conceded.get(b)! + ga);
    }
  }
  return ids.every((id) => conceded.get(id) === gsTarget.get(id));
}

const survivors: [number, number][][][] = [];
const seen = new Set<string>();
for (const order of permutations(ids)) {
  const cal = circle(order, 2);
  const sig = cal.slice(0, weeks.length + 4)
    .map((p) => p.map(([a, b]) => [a, b].sort().join("-")).sort().join("|")).join("#");
  if (seen.has(sig)) continue;
  if (consistent(cal)) { seen.add(sig); survivors.push(cal); }
}

console.log(`distinct circle-method schedules consistent with every settled result: ${survivors.length}`);

if (survivors.length) {
  const next = weeks[weeks.length - 1] + 1;
  const predictions = new Set(
    survivors.map((c) => c[next - 1].map(([a, b]) => [a, b].sort().join("-")).sort().join("  |  ")),
  );
  console.log(`\nall survivors agree on matchweek ${next}? ${predictions.size === 1}`);
  console.log(`\nPredicted matchweek ${next}:`);
  for (const [a, b] of survivors[0][next - 1]) {
    console.log(`  ${nameOf.get(a)!.padEnd(28)} vs  ${nameOf.get(b)}`);
  }
}
