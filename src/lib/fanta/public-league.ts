/**
 * Reads a real Leghe Fantacalcio league without signing in.
 *
 * The authenticated API refuses anonymous callers, but the legacy web pages do
 * not, and they carry more than they appear to:
 *
 *   /{alias}/squadre          embeds the whole competition — including the full
 *                             standings — as JSON in a `currentCompetition`
 *                             config block, rendered server-side, and every
 *                             team's name, manager and badge in a base64 blob.
 *   /{alias}/info-squadra?t=  names a single team, with its badge, in OpenGraph
 *                             meta tags. Only needed as a fallback now.
 *   /{alias}/classifica       redirects to the login wall, which is why the
 *                             standings are taken from the page above instead.
 *
 * The squadre page renders its team cards client-side from Handlebars templates,
 * so the visible markup carries only ids — but the data those templates consume
 * is on the page all along, base64-encoded in `__.s('lt', __.dp('…'))`. Reading
 * it turns what used to be one request per team into none.
 */

import { round2 } from "./scoring";
import type { Role } from "./types";

const HOST = "https://leghe.fantacalcio.it";

/** Where the site serves team badges from, when the page does not say. */
const CREST_BASE =
  "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2026/";

/**
 * The key the site's own client ships in its JavaScript. A handful of legacy
 * services accept it on its own, with no session behind it.
 */
const APP_KEY = "ICiELOObd5DF5uJEATi77CRvHiiRuMU0";

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "it-IT,it;q=0.9,en;q=0.8",
};

export interface PublicTeam {
  id: number;
  name: string;
  /** The person running the team. Empty when the page does not say. */
  manager: string;
  logo: string | null;
  position: number;
  played: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  fantapoints: number;
  penalty: number;
  group: string;
}

export interface PublicLeague {
  alias: string;
  competitionId: number;
  competitionName: string;
  leagueId: number;
  firstMatchweek: number;
  lastMatchweek: number;
  /** The matchweek the league is currently on, as the site itself reports it. */
  currentMatchweek: number;
  /** Serie A matchweek this competition's first matchweek is played on. */
  serieAStart: number;
  president: string;
  teams: PublicTeam[];
  fetchedAt: number;
}

/** Raw shape of a standings row in the embedded config. */
interface RawRow {
  id: number;
  g?: number;
  p?: number;
  s_p?: number;
  pos?: number;
  pen?: number;
  v?: number;
  n?: number;
  pr?: number;
  gf?: number;
  gs?: number;
  d_r?: number;
  gr?: string;
}

async function getHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);
  // A redirect means the page is behind the login wall.
  if (!res || res.status !== 200) return null;
  return res.text();
}

/**
 * Does a league with this alias exist?
 *
 * `/{alias}/classifica` redirects to `/{alias}` for a real league and to `/404`
 * for one that does not exist, which makes it a cheap existence check that needs
 * no credentials.
 */
export async function leagueExists(alias: string): Promise<boolean> {
  const res = await fetch(`${HOST}/${encodeURIComponent(alias)}/classifica`, {
    headers: BROWSER_HEADERS,
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);
  const location = res?.headers.get("location") ?? "";
  return !!location && !location.endsWith("/404");
}

/** Pulls a balanced `{ ... }` literal starting at `from`. */
function extractObject(text: string, from: number): string | null {
  const start = text.indexOf("{", from);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function readString(html: string, key: string): string {
  const match = html.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`));
  return match ? match[1] : "";
}

function readNumber(html: string, key: string, fallback: number): number {
  const value = Number(readString(html, key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Identity of one fantasy team, as the page's own templates receive it. */
interface TeamCard {
  name: string;
  manager: string;
  logo: string | null;
}

/** Raw team entry inside the page's base64 team blob. */
interface RawCard {
  id: number;
  n?: string;
  nu?: string;
  l?: string;
}

/**
 * Every team's name, manager and badge, straight out of the squadre page.
 *
 * The page hands its client templates a base64 payload — `__.s('lt', __.dp(…))`
 * — holding the same team records the authenticated API would return, minus the
 * rosters and purchase prices, which are blanked for anonymous callers. Teams
 * without a badge get a `no_logo{n}.png` placeholder rather than an empty field,
 * so those are mapped back to null.
 */
function readTeamCards(html: string): Map<number, TeamCard> {
  const cards = new Map<number, TeamCard>();

  const encoded = html.match(/__\.s\('lt',\s*__\.dp\('([^']*)'\)\)/)?.[1];
  if (!encoded) return cards;

  let payload: { data?: RawCard[] };
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as { data?: RawCard[] };
  } catch {
    return cards;
  }

  const base = readString(html, "crestsBaseUrl") || CREST_BASE;

  for (const card of payload.data ?? []) {
    const id = Number(card.id);
    if (!Number.isFinite(id)) continue;
    const file = card.l ?? "";
    cards.set(id, {
      name: String(card.n ?? "").trim() || `#${id}`,
      manager: String(card.nu ?? "").trim(),
      logo: file && !file.startsWith("no_logo") ? `${base}${file}` : null,
    });
  }
  return cards;
}

/** Team name and badge, from the per-team page's OpenGraph tags. */
async function fetchTeamIdentity(
  alias: string,
  teamId: number,
): Promise<{ name: string; logo: string | null }> {
  const html = await getHtml(`${HOST}/${alias}/info-squadra?t=${teamId}`);
  if (!html) return { name: `#${teamId}`, logo: null };

  const description =
    html.match(/property="og:description"\s+content="([^"]*)"/)?.[1] ?? "";
  // Formatted as `Lega {alias} - {team name}`.
  const name = description.split(" - ").slice(1).join(" - ").trim();
  const image = html.match(/property="og:image"\s+content="([^"]*)"/)?.[1] ?? "";

  return {
    name: name || `#${teamId}`,
    logo: image && !image.endsWith("socialfg.jpg") ? image : null,
  };
}

export async function fetchPublicLeague(
  alias: string,
): Promise<PublicLeague | null> {
  const html = await getHtml(`${HOST}/${alias}/squadre`);
  if (!html) return null;

  const anchor = html.indexOf("currentCompetition");
  if (anchor === -1) return null;
  const literal = extractObject(html, anchor);
  if (!literal) return null;

  let competition: {
    id?: number;
    id_lega?: number;
    nome?: string;
    giornata_inizio?: number;
    giornata_fine?: number;
    squadre?: RawRow[];
  };
  try {
    competition = JSON.parse(literal);
  } catch {
    return null;
  }

  const rows = competition.squadre ?? [];
  if (rows.length === 0) return null;

  // One blob covers every team; only teams it somehow omits cost a request.
  const cards = readTeamCards(html);
  const missing = rows.filter((row) => !cards.has(row.id));
  await Promise.all(
    missing.map(async (row) => {
      const identity = await fetchTeamIdentity(alias, row.id);
      cards.set(row.id, { ...identity, manager: "" });
    }),
  );

  const teams: PublicTeam[] = rows
    .map((row, i) => ({
      id: row.id,
      name: cards.get(row.id)?.name ?? `#${row.id}`,
      manager: cards.get(row.id)?.manager ?? "",
      logo: cards.get(row.id)?.logo ?? null,
      position: row.pos ?? i + 1,
      played: row.g ?? 0,
      points: row.p ?? 0,
      won: row.v ?? 0,
      drawn: row.n ?? 0,
      lost: row.pr ?? 0,
      goalsFor: row.gf ?? 0,
      goalsAgainst: row.gs ?? 0,
      goalDifference: row.d_r ?? 0,
      fantapoints: row.s_p ?? 0,
      penalty: row.pen ?? 0,
      group: row.gr ?? "",
    }))
    .sort((a, b) => a.position - b.position);

  return {
    alias,
    competitionId: competition.id ?? 0,
    competitionName: competition.nome ?? "",
    leagueId: competition.id_lega ?? 0,
    firstMatchweek: competition.giornata_inizio ?? 1,
    lastMatchweek: competition.giornata_fine ?? 38,
    currentMatchweek: readNumber(
      html,
      "currentTurn",
      competition.giornata_inizio ?? 1,
    ),
    serieAStart: readNumber(html, "competitionStartSerieA", 1),
    president: readString(html, "president"),
    teams,
    fetchedAt: Date.now(),
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** How many directory hits are worth resolving for one query. */
const DIRECTORY_LIMIT = 12;

/**
 * Names of leagues that list themselves publicly, matched against a query.
 *
 * `v1_leghe/leghepubbliche` is the site's own "join a public league" search, and
 * it answers with only the app key — no session. It returns names rather than
 * aliases, which is why the results still go through slugification below; what
 * it buys is a real corpus of league names instead of guessing that the user
 * typed theirs exactly.
 */
async function searchDirectory(query: string): Promise<string[]> {
  const res = await fetch(
    `${HOST}/servizi/v1_leghe/leghepubbliche?page=1&limit=${DIRECTORY_LIMIT}`,
    {
      method: "PUT",
      headers: {
        ...BROWSER_HEADERS,
        app_key: APP_KEY,
        "content-type": "application/json",
      },
      // Name only: the service also matches on a league's free-text blurb,
      // which drags in leagues that merely mention the words.
      body: JSON.stringify({ nome: query }),
      cache: "no-store",
    },
  ).catch(() => null);
  if (!res?.ok) return [];

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { leghe?: { n?: string }[] };
  } | null;
  if (!body?.success) return [];

  return (body.data?.leghe ?? [])
    .map((l) => slugify(String(l.n ?? "")))
    .filter((s) => s.length > 0);
}

/**
 * Turns a human league name into aliases that actually exist.
 *
 * Two sources, because neither is enough alone. The public-league directory
 * knows real league names but answers with names, not aliases, and only covers
 * leagues that opted into being listed. Private leagues — most of them — are
 * reachable only by guessing: an alias is a slug of the league's name, so the
 * query itself is slugified and probed in a few common shapes. Everything from
 * both sides is existence-checked before it is returned.
 */
export async function searchLeagues(query: string): Promise<string[]> {
  const slug = slugify(query);
  if (!slug) return [];

  const year = new Date().getFullYear();
  const guesses = [
    slug,
    `${slug}-fantacalcio`,
    `fantacalcio-${slug}`,
    `lega-${slug}`,
    `${slug}-lega`,
    `fanta-${slug}`,
    `${slug}-${year}`,
    `${slug}${year}`,
    `${slug}-${year}-${year + 1}`,
  ];

  const listed = await searchDirectory(query).catch(() => []);

  // Guesses first: an exact-name league is what the user most likely meant.
  const unique = [...new Set([...guesses, ...listed])];
  const found = await Promise.all(
    unique.map(async (alias) => ((await leagueExists(alias)) ? alias : null)),
  );
  return found.filter((a): a is string => a != null);
}

/* ------------------------------------------------------- matchweek history */

export interface MatchweekRow {
  matchweek: number;
  settled: boolean;
  points: number;
  fantapoints: number;
  /** V win, N draw, P loss. */
  result: "V" | "N" | "P";
}

export interface TeamHistory {
  teamId: number;
  rows: MatchweekRow[];
}

interface ConfrontoSide {
  id: number;
  punti?: number;
  somma_punti?: number;
  segno?: string;
}

/**
 * Per-matchweek record for two teams.
 *
 * `V1_LegheStatistiche/Confronto` is the one league service that answers with
 * only the public app key, no session. Despite taking two team ids, each side's
 * figures are that team's own result for the matchweek and do not depend on the
 * opponent passed in — verified by querying the same team against several
 * others and getting identical rows. That makes it usable as a per-team feed.
 *
 * Unplayed matchweeks come back as zeroes with `calcolata: false`, so a league's
 * in-progress round has no figures here at all. Reconstructing that round is
 * what `public-live.ts` is for.
 */
export async function fetchHistory(
  leagueId: number,
  competitionId: number,
  teamA: number,
  teamB: number,
): Promise<{ a: TeamHistory; b: TeamHistory } | null> {
  const url =
    `${HOST}/servizi/V1_LegheStatistiche/Confronto` +
    `?id_lega=${leagueId}&id_squadra_a=${teamA}` +
    `&id_squadra_b=${teamB}&id_competizione=${competitionId}`;

  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, app_key: APP_KEY },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { giornata: number; calcolata: boolean; sq_a: ConfrontoSide; sq_b: ConfrontoSide }[];
  } | null;
  if (!body?.success || !body.data) return null;

  const side = (pick: "sq_a" | "sq_b", id: number): TeamHistory => ({
    teamId: id,
    rows: body.data!.map((row) => {
      const s = row[pick];
      const sign = s.segno === "V" || s.segno === "P" ? s.segno : "N";
      return {
        matchweek: row.giornata,
        settled: !!row.calcolata,
        points: Number(s.punti ?? 0),
        fantapoints: Number(s.somma_punti ?? 0),
        result: sign as "V" | "N" | "P",
      };
    }),
  });

  return { a: side("sq_a", teamA), b: side("sq_b", teamB) };
}

/* -------------------------------------------------------------- rosters */

export interface PublicRosterPlayer {
  /** Same id the live Serie A feed uses, so the two join directly. */
  id: number;
  name: string;
  club: string;
  role: Role;
  appearances: number;
  /** Season average rating. */
  averageGrade: number;
  /** Season average rating with bonus and malus folded in. */
  averageFantaGrade: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

/**
 * Raw per-player season line.
 *
 * Every counter is split in two: `_c` for the player's home Serie A matches and
 * `_f` for the away ones. The pair has to be summed to get a season figure, and
 * `vt` alone is already the combined average.
 */
interface RawStatLine {
  id_c: number;
  n?: string;
  s?: string;
  r?: string;
  g_c?: number;
  g_f?: number;
  vt?: number;
  vt_c?: number;
  vt_f?: number;
  b_c?: number;
  b_f?: number;
  m_c?: number;
  m_f?: number;
  gf_c?: number;
  gf_f?: number;
  ass_c?: number;
  ass_f?: number;
  amm_c?: number;
  amm_f?: number;
  esp_c?: number;
  esp_f?: number;
}

const ROLES = new Set<Role>(["P", "D", "C", "A"]);

/**
 * A fantasy team's whole squad, without signing in.
 *
 * The squadre page blanks the `cal` roster field for anonymous callers, and the
 * roster endpoints all refuse them — but `V1_LegheStatistiche/Statistiche` is
 * one of the legacy services that answers on the app key alone, and it returns a
 * line per owned player, including players who have never been fielded. That
 * makes it the roster, spelled as statistics.
 *
 * Its player ids are the live feed's ids, so nothing has to be matched by name.
 */
export async function fetchRoster(
  alias: string,
  leagueId: number,
  teamId: number,
): Promise<PublicRosterPlayer[] | null> {
  const url =
    `${HOST}/servizi/V1_LegheStatistiche/Statistiche` +
    `?alias_lega=${encodeURIComponent(alias)}&id_lega=${leagueId}` +
    `&id_squadra=${teamId}`;

  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, app_key: APP_KEY },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: RawStatLine[];
  } | null;
  if (!body?.success || !Array.isArray(body.data)) return null;

  const sum = (a: number | undefined, b: number | undefined) =>
    Number(a ?? 0) + Number(b ?? 0);

  return body.data.map((row) => {
    const appearances = sum(row.g_c, row.g_f);
    // Bonus and malus are season totals for each half of the split, not averages.
    const modifiers = sum(row.b_c, row.b_f) + sum(row.m_c, row.m_f);
    const ratings =
      Number(row.vt_c ?? 0) * Number(row.g_c ?? 0) +
      Number(row.vt_f ?? 0) * Number(row.g_f ?? 0);
    const role = String(row.r ?? "") as Role;

    return {
      id: Number(row.id_c),
      name: String(row.n ?? ""),
      club: String(row.s ?? ""),
      role: ROLES.has(role) ? role : "C",
      appearances,
      averageGrade: round2(Number(row.vt ?? 0)),
      averageFantaGrade: appearances
        ? round2((ratings + modifiers) / appearances)
        : 0,
      goals: sum(row.gf_c, row.gf_f),
      assists: sum(row.ass_c, row.ass_f),
      yellowCards: sum(row.amm_c, row.amm_f),
      redCards: sum(row.esp_c, row.esp_f),
    };
  });
}

/** Every team's squad, one request per team. */
export async function fetchAllRosters(
  league: PublicLeague,
): Promise<Map<number, PublicRosterPlayer[]>> {
  const out = new Map<number, PublicRosterPlayer[]>();
  await Promise.all(
    league.teams.map(async (team) => {
      const roster = await fetchRoster(
        league.alias,
        league.leagueId,
        team.id,
      ).catch(() => null);
      if (roster?.length) out.set(team.id, roster);
    }),
  );
  return out;
}

/* ------------------------------------------------------- matchweek view */

export interface MatchweekEntry {
  teamId: number;
  name: string;
  logo: string | null;
  fantapoints: number;
  goals: number;
  points: number;
  result: "V" | "N" | "P";
}

export interface StandingAt {
  teamId: number;
  name: string;
  logo: string | null;
  position: number;
  played: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  fantapoints: number;
}

export interface MatchweekView {
  matchweek: number;
  settled: boolean;
  lastSettled: number;
  lastMatchweek: number;
  entries: MatchweekEntry[];
  tableAfter: StandingAt[];
}

/**
 * Fantapoints convert to goals at a fixed threshold: the first at 66, then one
 * every 6. Leagues can retune this, but it is the standard table and it
 * reproduces the official scores for the leagues checked against.
 */
export function goalsFromFantapoints(fp: number, first = 66, step = 6): number {
  return fp < first ? 0 : 1 + Math.floor((fp - first) / step);
}

/** Every team's history, one request per team. */
export async function fetchAllHistories(
  league: PublicLeague,
): Promise<Map<number, MatchweekRow[]>> {
  const ids = league.teams.map((t) => t.id);
  const out = new Map<number, MatchweekRow[]>();
  if (ids.length < 2) return out;

  await Promise.all(
    ids.map(async (id) => {
      const partner = ids.find((x) => x !== id)!;
      const h = await fetchHistory(
        league.leagueId,
        league.competitionId,
        id,
        partner,
      ).catch(() => null);
      out.set(id, h?.a.rows ?? []);
    }),
  );
  return out;
}

/**
 * One matchweek's results plus the table as it stood after it.
 *
 * Who played whom is deliberately absent: the calendar is behind the login wall,
 * and it cannot be recovered from what is public — result signs and conceded-goal
 * totals leave several fixture lists consistent with the same data, so any
 * pairing shown here would be a guess. Goals against are omitted from the
 * historical table for the same reason.
 */
export function buildMatchweekView(
  league: PublicLeague,
  histories: Map<number, MatchweekRow[]>,
  matchweek: number,
): MatchweekView {
  const meta = new Map(league.teams.map((t) => [t.id, t]));

  const lastSettled = Math.max(
    0,
    ...[...histories.values()].flatMap((rows) =>
      rows.filter((r) => r.settled).map((r) => r.matchweek),
    ),
  );

  const entries: MatchweekEntry[] = [];
  for (const [teamId, rows] of histories) {
    const row = rows.find((r) => r.matchweek === matchweek);
    const team = meta.get(teamId);
    if (!row || !team) continue;
    entries.push({
      teamId,
      name: team.name,
      logo: team.logo,
      fantapoints: row.fantapoints,
      goals: goalsFromFantapoints(row.fantapoints),
      points: row.points,
      result: row.result,
    });
  }
  entries.sort((a, b) => b.fantapoints - a.fantapoints);

  const settled = entries.length > 0 && matchweek <= lastSettled;

  // Cumulative table through this matchweek, recomputed from the per-matchweek
  // records. Goals against need the fixtures, so they are left out.
  const table: StandingAt[] = league.teams.map((team) => {
    const rows = (histories.get(team.id) ?? []).filter(
      (r) => r.settled && r.matchweek <= matchweek,
    );
    return {
      teamId: team.id,
      name: team.name,
      logo: team.logo,
      position: 0,
      played: rows.length,
      points: rows.reduce((s, r) => s + r.points, 0),
      won: rows.filter((r) => r.result === "V").length,
      drawn: rows.filter((r) => r.result === "N").length,
      lost: rows.filter((r) => r.result === "P").length,
      goalsFor: rows.reduce((s, r) => s + goalsFromFantapoints(r.fantapoints), 0),
      fantapoints:
        Math.round(rows.reduce((s, r) => s + r.fantapoints, 0) * 100) / 100,
    };
  });

  table.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - a.goalsFor ||
      b.fantapoints - a.fantapoints ||
      a.name.localeCompare(b.name),
  );
  table.forEach((row, i) => (row.position = i + 1));

  return {
    matchweek,
    settled,
    lastSettled,
    lastMatchweek: league.lastMatchweek,
    entries,
    tableAfter: table,
  };
}
