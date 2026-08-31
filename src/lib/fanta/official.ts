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

  return {
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
