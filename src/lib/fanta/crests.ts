/**
 * Serie A club crests.
 *
 * The live feed identifies clubs by numeric id but carries no image, and the
 * crest files are named by an irregular slug rather than that id — `bolognanew`,
 * `sassuolooriginal`, `napoli_2024_new` — because the assets are versioned by
 * hand whenever a club restyles its badge. There is no endpoint that maps one to
 * the other, so the mapping is pinned here, read off the official site's own
 * markup.
 *
 * A missing entry is not an error: `crestUrl` returns null and callers fall back
 * to a lettered placeholder, so a newly promoted club never breaks the layout.
 */
const CREST_SLUG: Record<number, string> = {
  1: "atalanta2026",
  2: "bolognanew",
  6: "fiorentina2022",
  7: "frosinone",
  8: "genoa_new",
  9: "inter2021",
  10: "juventus_2024",
  11: "lazio",
  12: "milan",
  13: "napoli_2024_new",
  15: "roma",
  17: "sassuolooriginal",
  18: "torino",
  19: "udinese",
  21: "cagliari",
  107: "parma",
  119: "lecce",
  138: "venezia_2026",
  143: "monza_2024",
  153: "como_2024",
};

const BASE = "https://content.fantacalcio.it/web/img/team/ico/";

export function crestUrl(teamId: number): string | null {
  const slug = CREST_SLUG[teamId];
  return slug ? `${BASE}${slug}.png` : null;
}
