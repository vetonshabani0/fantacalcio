/**
 * Client for the real Leghe Fantacalcio backends.
 *
 * There is no public league API and no league search: every league route on
 * both backends rejects anonymous callers (`ATH008 Bearer token missing` on
 * apileague, `AD05 non hai le credenziali` on the legacy service). The only way
 * to read a real league is to authenticate as one of its members, which is
 * exactly what the official web client does.
 *
 * Two backends are in play, with different auth:
 *   - apileague.fantacalcio.it  ->  app_key header + `Authorization: Bearer <league jwt>`
 *   - leghe.fantacalcio.it/servizi -> app_key header + the session cookies from login
 *
 * Wire shapes here were read off the official client bundle; the parser
 * functions below mirror its own `Ca()` (user) and `Ea()` (leagues) mappers.
 */

const APP_KEY = "ICiELOObd5DF5uJEATi77CRvHiiRuMU0";
const API_BASE = "https://apileague.fantacalcio.it";
const LEGACY_BASE = "https://leghe.fantacalcio.it/servizi";
const ORIGIN = "https://leghe.fantacalcio.it";

export interface OfficialUser {
  id: number | string;
  username: string;
  email?: string;
  /** Account-level bearer, used before a league has been picked. */
  jwt?: string;
}

export interface OfficialLeague {
  id: number;
  name: string;
  alias: string;
  /** Per-league bearer token; every league call is signed with this. */
  jwt: string;
  /** 1 = Classic, 2 = Mantra, in the platform's own numbering. */
  type: number;
  logo?: string;
  isAdmin: boolean;
  order: number;
}

export interface OfficialSession {
  user: OfficialUser;
  leagues: OfficialLeague[];
  /** Cookie header replayed on legacy calls. */
  cookie: string;
  /** Set only when login succeeded but no leagues parsed, to aid diagnosis. */
  shape?: {
    topLevelKeys: string[];
    dataKeys: string[];
    legheType: string;
  };
}

export class OfficialError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OfficialError";
  }
}

function baseHeaders(): Record<string, string> {
  return {
    app_key: APP_KEY,
    accept: "application/json",
    origin: ORIGIN,
    referer: `${ORIGIN}/`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  };
}

/** Collapses a Set-Cookie list into a single Cookie header value. */
function collectCookies(response: Response, previous = ""): string {
  const jar = new Map<string, string>();
  for (const pair of previous.split("; ").filter(Boolean)) {
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }

  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);

  for (const line of raw) {
    const first = line.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }

  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/* ------------------------------------------------------------------ login */

interface RawLeague {
  ordine?: number | string;
  id: number | string;
  nome?: string;
  alias?: string;
  logo?: string;
  tipo_gioco?: number | string;
  visibile?: boolean;
  jwt?: string;
  admin?: number | string;
}

/** Mirrors the official client's `Ea()` league mapper. */
function parseLeagues(raw: unknown): OfficialLeague[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.values(raw as Record<string, RawLeague>)
    .filter((l) => l && l.id != null)
    .map((l) => ({
      order: Number(l.ordine ?? 0),
      id: Number(l.id),
      name: String(l.nome ?? l.alias ?? "Lega"),
      alias: String(l.alias ?? ""),
      logo: l.logo,
      type: Number(l.tipo_gioco ?? 1),
      jwt: String(l.jwt ?? ""),
      isAdmin: Number(l.admin ?? 0) > 0,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function login(
  username: string,
  password: string,
): Promise<OfficialSession> {
  const response = await fetch(`${API_BASE}/onboarding/v1/login`, {
    method: "POST",
    headers: { ...baseHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const code = body?.code as string | undefined;
    const message =
      code === "ATH018"
        ? "Username o password non corretti."
        : ((body?.message as string) ?? `Login fallito (${response.status})`);
    throw new OfficialError(message, response.status, code);
  }

  // The payload nests the account under `utente` and the leagues under `leghe`.
  const data = ((body?.data as Record<string, unknown>) ?? body ?? {}) as Record<
    string,
    unknown
  >;
  const account = {
    ...data,
    ...((data.utente as Record<string, unknown>) ?? {}),
  } as Record<string, unknown>;

  const leagues = parseLeagues(data.leghe);

  // A successful login that yields no leagues is ambiguous: the account really
  // has none, or the payload is not shaped the way the client bundle implied.
  // Record the actual keys so the two can be told apart instead of guessing.
  const shape =
    leagues.length === 0
      ? {
          topLevelKeys: Object.keys(body ?? {}),
          dataKeys: Object.keys(data),
          legheType: typeof data.leghe,
        }
      : undefined;

  return {
    shape,
    user: {
      id: (account.id as number) ?? 0,
      username: String(account.username ?? username),
      email: account.email as string | undefined,
      jwt: (account.jwt as string) ?? undefined,
    },
    leagues,
    cookie: collectCookies(response),
  };
}

/* ------------------------------------------------------- authorised reads */

async function apiGet<T>(
  path: string,
  jwt: string,
  cookie: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...baseHeaders(),
      authorization: `Bearer ${jwt}`,
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = body as { code?: string; message?: string } | null;
    throw new OfficialError(
      err?.message ?? `Richiesta fallita (${response.status})`,
      response.status,
      err?.code,
    );
  }
  return body as T;
}

/** The legacy service wraps everything in {success, data, error_msgs}. */
async function legacyGet<T>(
  path: string,
  params: Record<string, string | number>,
  cookie: string,
): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const response = await fetch(`${LEGACY_BASE}${path}?${query}`, {
    headers: { ...baseHeaders(), ...(cookie ? { cookie } : {}) },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error_msgs?: { id: string; descrizione: string }[];
  } | null;

  if (!response.ok || !body || body.success === false) {
    const first = body?.error_msgs?.[0];
    throw new OfficialError(
      first?.descrizione ?? `Richiesta fallita (${response.status})`,
      response.status,
      first?.id,
    );
  }
  return (body.data ?? (body as unknown)) as T;
}

/* ----------------------------------------------------------- league reads */

export interface OfficialCompetition {
  id: number;
  name: string;
  type?: number;
  startMatchweek?: number;
  endMatchweek?: number;
}

export async function getCompetitions(
  league: OfficialLeague,
  cookie: string,
): Promise<OfficialCompetition[]> {
  const raw = await apiGet<unknown>(
    "/onboarding/v1/league/competitions",
    league.jwt,
    cookie,
  );
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { data?: unknown[] })?.data ?? []);

  return (list as Record<string, unknown>[]).map((c) => ({
    id: Number(c.id ?? c.idcomp ?? 0),
    name: String(c.name ?? c.nome ?? c.descrizione ?? "Competizione"),
    type: c.type != null ? Number(c.type) : undefined,
    startMatchweek:
      c.startingMatchweek != null
        ? Number(c.startingMatchweek)
        : c.giornata_inizio != null
          ? Number(c.giornata_inizio)
          : undefined,
    endMatchweek:
      c.endingMatchweek != null
        ? Number(c.endingMatchweek)
        : c.giornata_fine != null
          ? Number(c.giornata_fine)
          : undefined,
  }));
}

/**
 * The official standings endpoint. Returns one row per team; field names are
 * kept raw here because the legacy service is inconsistent between league
 * types, and the caller normalises.
 */
export async function getStandings(
  league: OfficialLeague,
  competitionId: number,
  cookie: string,
  from = 1,
  to = 60,
): Promise<Record<string, unknown>[]> {
  const raw = await legacyGet<unknown>(
    "/v1_legheCompetizione/classificagiornate",
    {
      alias_lega: league.alias,
      id_competizione: competitionId,
      giornata_inizio: from,
      giornata_fine: to,
    },
    cookie,
  );
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

/** Lineups for a matchweek: the source of the head-to-head and substitutions. */
export async function getLineups(
  league: OfficialLeague,
  competitionId: number,
  matchweek: number,
  cookie: string,
): Promise<unknown> {
  return apiGet<unknown>(
    `/gaming/v1/teamLineup/visualizza/${competitionId}/${matchweek}`,
    league.jwt,
    cookie,
  );
}

export async function getCalendar(
  league: OfficialLeague,
  competitionId: number,
  cookie: string,
): Promise<unknown> {
  return apiGet<unknown>(
    `/onboarding/v1/league/competition/calendar/${competitionId}`,
    league.jwt,
    cookie,
  );
}

export async function getLeagueStatus(
  league: OfficialLeague,
  cookie: string,
): Promise<unknown> {
  return apiGet<unknown>("/onboarding/v1/league/status", league.jwt, cookie);
}

export async function getLeagueTeams(
  league: OfficialLeague,
  cookie: string,
): Promise<unknown> {
  return apiGet<unknown>("/onboarding/v1/league/teams", league.jwt, cookie);
}

/* --------------------------------------------------- calendar, signed in */

/**
 * The calendar export, fetched with the member's own session.
 *
 * This is the same file the "Scarica ora" button downloads. Anonymous callers
 * get `AD05` from it, but a signed-in session is accepted, so a logged-in user
 * never has to download and re-upload anything by hand.
 */
export async function downloadCalendarExcel(
  league: OfficialLeague,
  competitionId: number,
  competitionName: string,
  cookie: string,
): Promise<ArrayBuffer | null> {
  const query = new URLSearchParams({
    alias_lega: league.alias,
    id_competizione: String(competitionId),
    nome_competizione: competitionName,
  });

  const response = await fetch(
    `${LEGACY_BASE}/v1_legheCompetizione/excel?${query}`,
    {
      headers: { ...baseHeaders(), ...(cookie ? { cookie } : {}) },
      cache: "no-store",
    },
  ).catch(() => null);

  if (!response?.ok) return null;

  // The service answers with JSON, not a spreadsheet, when it refuses.
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) return null;

  return response.arrayBuffer();
}

/** The calendar as JSON, if the newer API will serve it for this league. */
export async function getCalendarJson(
  league: OfficialLeague,
  competitionId: number,
  cookie: string,
): Promise<unknown | null> {
  return apiGet<unknown>(
    `/onboarding/v1/league/competition/calendar/${competitionId}`,
    league.jwt,
    cookie,
  ).catch(() => null);
}

/* ------------------------------------------------- squads and fixtures */

export interface OfficialTeam {
  id: number;
  name: string;
  manager: string;
  logo: string | null;
  /** Player ids owned by this team. */
  roster: number[];
  /** Purchase price per roster slot, aligned with `roster`. */
  costs: number[];
  creditsLeft: number;
}

export interface OfficialPlayer {
  id: number;
  name: string;
  /** Serie A club. */
  club: string;
  /** Serie A club id, matching the live feed's team ids. */
  clubId: number;
  /** Classic role: 1 P, 2 D, 3 C, 4 A. */
  role: "P" | "D" | "C" | "A";
  averageGrade: number;
  averageFantaGrade: number;
  marketValue: number;
}

const CLASSIC_ROLE: Record<number, OfficialPlayer["role"]> = {
  1: "P",
  2: "D",
  3: "C",
  4: "A",
};

/**
 * Every team with its squad.
 *
 * The roster arrives as a semicolon-joined list of player ids in `cal`, with the
 * matching purchase prices in `cs`.
 */
export async function getLeagueTeamsFull(
  league: OfficialLeague,
  cookie: string,
): Promise<OfficialTeam[]> {
  const raw = await apiGet<{ data?: Record<string, unknown>[] }>(
    "/onboarding/v1/league/teams",
    league.jwt,
    cookie,
  );

  const split = (value: unknown): number[] =>
    String(value ?? "")
      .split(";")
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);

  return (raw.data ?? []).map((t) => ({
    id: Number(t.id),
    name: String(t.n ?? ""),
    manager: String(t.nu ?? ""),
    logo: t.l ? `${LOGO_BASE}${t.l}` : null,
    roster: split(t.cal),
    costs: split(t.cs),
    creditsLeft: Number(t.cr ?? 0),
  }));
}

const LOGO_BASE =
  "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2026/";

/** The league's player database, keyed by player id. */
export async function getLeaguePlayers(
  league: OfficialLeague,
  cookie: string,
): Promise<Map<number, OfficialPlayer>> {
  const raw = await apiGet<{ players?: Record<string, unknown>[] }>(
    "/onboarding/v1/league/players",
    league.jwt,
    cookie,
  );

  const out = new Map<number, OfficialPlayer>();
  for (const p of raw.players ?? []) {
    const id = Number(p.id);
    if (!Number.isFinite(id)) continue;
    out.set(id, {
      id,
      name: String(p.name ?? ""),
      club: String(p.tname ?? ""),
      clubId: Number(p.tid ?? 0),
      role: CLASSIC_ROLE[Number(p.fcrle)] ?? "C",
      averageGrade: Number(p.agrd ?? 0),
      averageFantaGrade: Number(p.fagrd ?? 0),
      marketValue: Number(p.fvmfc ?? 0),
    });
  }
  return out;
}

export interface OfficialFixture {
  matchweek: number;
  serieAMatchweek: number;
  calculated: boolean;
  homeTeamId: number;
  awayTeamId: number;
  homeFantapoints: number;
  awayFantapoints: number;
  homeGoals: number;
  awayGoals: number;
  homePoints: number;
  awayPoints: number;
}

/**
 * The official fixture list, with the results the league actually recorded.
 *
 * Preferred over deriving anything locally: it carries the real pairings, the
 * fantasy scores on each side and the goal conversion the league itself applied,
 * so no thresholds have to be assumed.
 */
export async function getOfficialCalendar(
  league: OfficialLeague,
  competitionId: number,
  cookie: string,
): Promise<OfficialFixture[]> {
  const raw = await apiGet<unknown>(
    `/onboarding/v1/league/competition/calendar/${competitionId}`,
    league.jwt,
    cookie,
  );

  const days = Array.isArray(raw) ? raw : [];
  const out: OfficialFixture[] = [];

  for (const day of days as Record<string, unknown>[]) {
    const matchweek = Number(day.matchDay ?? 0);
    if (!matchweek) continue;
    const serieA = Number(day.championshipMatchDay ?? matchweek);
    const calculated = !!day.calculated;

    for (const m of (day.matches as Record<string, unknown>[]) ?? []) {
      // `result` is a plain "3-3"; fall back to zeroes when not yet played.
      const [gh, ga] = String(m.result ?? "")
        .split("-")
        .map((n) => Number(n.trim()));

      out.push({
        matchweek,
        serieAMatchweek: serieA,
        calculated,
        homeTeamId: Number(m.tIdH),
        awayTeamId: Number(m.tIdA),
        homeFantapoints: Number(m.ptH ?? 0),
        awayFantapoints: Number(m.ptA ?? 0),
        homeGoals: Number.isFinite(gh) ? gh : 0,
        awayGoals: Number.isFinite(ga) ? ga : 0,
        homePoints: Number(m.standingPtH ?? 0),
        awayPoints: Number(m.standingPtA ?? 0),
      });
    }
  }

  return out.sort((a, b) => a.matchweek - b.matchweek);
}
