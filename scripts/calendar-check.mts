import { buildCalendar, type Team } from "../src/lib/fanta/league";

for (const size of [2, 4, 5, 8, 10]) {
  const teams: Team[] = Array.from({ length: size }, (_, i) => ({
    id: `t${i + 1}`,
    name: `T${i + 1}`,
    manager: "",
    roster: [],
  }));
  const fixtures = buildCalendar(teams);

  const pairs = new Map<string, number>();
  const homeCount = new Map<string, number>();
  const perWeek = new Map<number, Set<string>>();
  let doubleBooked = 0;

  for (const f of fixtures) {
    const key = [f.homeTeamId, f.awayTeamId].sort().join("|");
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
    homeCount.set(f.homeTeamId, (homeCount.get(f.homeTeamId) ?? 0) + 1);
    const week = perWeek.get(f.matchweek) ?? new Set<string>();
    if (week.has(f.homeTeamId) || week.has(f.awayTeamId)) doubleBooked++;
    week.add(f.homeTeamId);
    week.add(f.awayTeamId);
    perWeek.set(f.matchweek, week);
  }

  const expectedPairs = (size * (size - 1)) / 2;
  const allTwice = [...pairs.values()].every((n) => n === 2);
  const weeks = Math.max(...fixtures.map((f) => f.matchweek));
  const homeSpread = [...homeCount.values()].sort((a, b) => a - b);

  console.log(
    `${String(size).padStart(2)} teams: ${fixtures.length} fixtures, ${weeks} weeks,`,
    `distinct pairs ${pairs.size}/${expectedPairs},`,
    `every pair twice: ${allTwice},`,
    `double-booked: ${doubleBooked},`,
    `home games ${homeSpread[0]}–${homeSpread[homeSpread.length - 1]}`,
  );
}
