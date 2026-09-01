/**
 * Reads a real Leghe Fantacalcio league without signing in.
 *
 * The authenticated API refuses anonymous callers, but the legacy web pages do
 * not, and they carry more than they appear to:
 *
 *   /{alias}/squadre          embeds the whole competition — including the full
 *                             standings — as JSON in a `currentCompetition`
 *                             config block, rendered server-side.
 *   /{alias}/info-squadra?t=  names a single team, with its badge, in OpenGraph
 *                             meta tags.
 *   /{alias}/classifica       redirects to the login wall, which is why the
 *                             standings are taken from the page above instead.
 *
 * Team names are deliberately fetched one request per team: the squadre page
 * renders its team cards client-side from Handlebars templates, so the names are
 * simply not in its markup, only the ids.
 */

const HOST = "https://leghe.fantacalcio.it";

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "it-IT,it;q=0.9,en;q=0.8",
};

export interface PublicTeam {
  id: number;
  name: string;
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

  const identities = await Promise.all(
    rows.map((row) => fetchTeamIdentity(alias, row.id)),
  );

  const teams: PublicTeam[] = rows
    .map((row, i) => ({
      id: row.id,
      name: identities[i].name,
      logo: identities[i].logo,
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
    president: readString(html, "president"),
    teams,
    fetchedAt: Date.now(),
  };
}

/**
 * Turns a human league name into candidate aliases and returns those that exist.
 *
 * There is no league directory to search, but aliases are slugs of the league
 * name, so slugifying the query and probing a handful of common shapes finds a
 * league by name in practice.
 */
export async function searchLeagues(query: string): Promise<string[]> {
  const slug = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) return [];

  const year = new Date().getFullYear();
  const candidates = [
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

  const unique = [...new Set(candidates)];
  const found = await Promise.all(
    unique.map(async (alias) => ((await leagueExists(alias)) ? alias : null)),
  );
  return found.filter((a): a is string => a != null);
}
