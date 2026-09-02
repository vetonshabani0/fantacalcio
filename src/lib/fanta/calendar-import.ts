import * as XLSX from "xlsx";

/**
 * Parses the calendar spreadsheet that Leghe Fantacalcio lets a league member
 * export ("Scarica ora" on the competition page).
 *
 * The fixture list is the one piece of league data with no public route: its
 * controller rejects every action name, signed-in or not, and it cannot be
 * derived from what is public — result signs and conceded-goal totals still
 * leave several fixture lists consistent with the same season.
 *
 * The export sidesteps that without anyone sharing credentials: the member
 * downloads their own file and uploads it here.
 *
 * The sheet layout is not documented and varies between competition formats, so
 * this reads defensively: it scans for matchweek headers and for rows naming two
 * known teams, rather than assuming fixed columns.
 */

export interface ImportedFixture {
  matchweek: number;
  homeTeamId: number;
  awayTeamId: number;
  /** Present when the source carried the official result, not just the pairing. */
  homeGoals?: number;
  awayGoals?: number;
  homeFantapoints?: number;
  awayFantapoints?: number;
}

export interface ImportResult {
  fixtures: ImportedFixture[];
  matchweeks: number;
  unmatchedRows: string[];
  warnings: string[];
}

/** Loose match: ignores case, accents, punctuation and spacing. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** "1ª giornata", "Giornata 3", "3° giornata di Serie A" → 1, 3, 3 */
function readMatchweek(text: string): number | null {
  const t = text.toLowerCase();
  if (!t.includes("giornata") && !t.includes("matchweek")) return null;
  const m = t.match(/(\d{1,2})\s*[ª°^]?\s*giornata|giornata\s*(\d{1,2})/);
  const n = Number(m?.[1] ?? m?.[2]);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? n : null;
}

export function parseCalendarWorkbook(
  buffer: ArrayBuffer,
  teams: { id: number; name: string }[],
): ImportResult {
  const book = XLSX.read(buffer, { type: "array" });
  const byName = new Map(teams.map((t) => [normalise(t.name), t.id]));

  const fixtures: ImportedFixture[] = [];
  const unmatchedRows: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });

    let current = 0;
    for (const row of rows) {
      const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (cells.length === 0) continue;

      const header = cells.map(readMatchweek).find((n) => n != null) ?? null;

      // Look for two known team names on the row. This runs before the header
      // check because some exports repeat the matchweek on every fixture row,
      // and treating those as headers would drop every fixture.
      const found: number[] = [];
      for (const cell of cells) {
        const id = byName.get(normalise(cell));
        if (id != null && !found.includes(id)) found.push(id);
      }

      if (found.length < 2) {
        // No fixture here, so a matchweek marker means a section header.
        if (header != null) current = header;
        continue;
      }

      if (found.length === 2) {
        const mw = header ?? current;
        if (!mw) {
          warnings.push(`Fixture found before any matchweek header: ${cells.join(" | ")}`);
          continue;
        }
        const key = `${mw}:${found[0]}:${found[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fixtures.push({ matchweek: mw, homeTeamId: found[0], awayTeamId: found[1] });
      } else if (found.length > 2) {
        unmatchedRows.push(cells.join(" | "));
      }
    }
  }

  fixtures.sort((a, b) => a.matchweek - b.matchweek);
  const matchweeks = new Set(fixtures.map((f) => f.matchweek)).size;

  if (fixtures.length === 0) {
    warnings.push(
      "No fixtures recognised. The team names in the file must match the league's team names.",
    );
  }

  return { fixtures, matchweeks, unmatchedRows: unmatchedRows.slice(0, 10), warnings };
}

/**
 * Reads fixtures out of the newer API's JSON calendar.
 *
 * Its exact shape is undocumented and differs by competition format, so rather
 * than assume field names this walks the structure looking for objects that
 * carry a matchweek and two known team ids.
 */
export function parseCalendarJson(
  payload: unknown,
  teamIds: number[],
): ImportedFixture[] {
  const known = new Set(teamIds);
  const fixtures: ImportedFixture[] = [];
  const seen = new Set<string>();

  const matchweekOf = (o: Record<string, unknown>): number | null => {
    for (const key of ["matchweek", "giornata", "mday", "turno", "round", "g"]) {
      const v = Number(o[key]);
      if (Number.isFinite(v) && v >= 1 && v <= 60) return v;
    }
    return null;
  };

  const teamsOf = (o: Record<string, unknown>): number[] => {
    const found: number[] = [];
    for (const [key, value] of Object.entries(o)) {
      if (/id|squadra|team|casa|ospite|home|away/i.test(key)) {
        const n = Number(
          typeof value === "object" && value
            ? (value as Record<string, unknown>).id
            : value,
        );
        if (known.has(n) && !found.includes(n)) found.push(n);
      }
    }
    return found;
  };

  const walk = (node: unknown, inherited: number | null, depth: number) => {
    if (!node || typeof node !== "object" || depth > 6) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, inherited, depth + 1);
      return;
    }

    const obj = node as Record<string, unknown>;
    const mw = matchweekOf(obj) ?? inherited;
    const pair = teamsOf(obj);

    if (mw != null && pair.length === 2) {
      const key = `${mw}:${pair[0]}:${pair[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        fixtures.push({ matchweek: mw, homeTeamId: pair[0], awayTeamId: pair[1] });
      }
    }

    for (const value of Object.values(obj)) walk(value, mw, depth + 1);
  };

  walk(payload, null, 0);
  fixtures.sort((a, b) => a.matchweek - b.matchweek);
  return fixtures;
}
