/**
 * Serie A home kits, drawn rather than fetched.
 *
 * Neither Fantacalcio CDN publishes club kit images — only crests — so the
 * shirts are generated from each club's colours and pattern. That also keeps the
 * cards fast and dependency-free, and a club with no entry still renders a
 * neutral shirt rather than a hole in the lineup.
 *
 * Ids match the live feed's Serie A team ids.
 */

export type KitPattern = "solid" | "stripes" | "halves" | "hoops" | "sash";

export interface Kit {
  pattern: KitPattern;
  /** Base colour of the shirt. */
  primary: string;
  /** Stripe, half, hoop or sash colour. */
  secondary?: string;
  /** Sleeve colour, when it differs from the body. */
  sleeve?: string;
  /** Trim and collar. */
  accent?: string;
  /** Stripe or hoop count, for the patterned kits. */
  bands?: number;
}

export const KITS: Record<number, Kit> = {
  1: { pattern: "stripes", primary: "#1B1B1B", secondary: "#1E71B8", bands: 7 }, // Atalanta
  2: { pattern: "stripes", primary: "#1A2F55", secondary: "#9F1B32", bands: 6 }, // Bologna
  6: { pattern: "solid", primary: "#5A2D82", accent: "#FFFFFF" }, // Fiorentina
  7: { pattern: "stripes", primary: "#F2C41D", secondary: "#1B4C9B", bands: 6 }, // Frosinone
  8: { pattern: "halves", primary: "#B4142E", secondary: "#12294B" }, // Genoa
  9: { pattern: "stripes", primary: "#0B0B0B", secondary: "#1B5CB8", bands: 7 }, // Inter
  10: { pattern: "stripes", primary: "#FFFFFF", secondary: "#111111", bands: 7 }, // Juventus
  11: { pattern: "solid", primary: "#8FC6EA", accent: "#0B2B4A" }, // Lazio
  12: { pattern: "stripes", primary: "#C8102E", secondary: "#0B0B0B", bands: 6 }, // Milan
  13: { pattern: "solid", primary: "#12A0DC", accent: "#0B3A5A" }, // Napoli
  15: { pattern: "solid", primary: "#8E1F2F", accent: "#E0B64C" }, // Roma
  17: { pattern: "stripes", primary: "#0E9448", secondary: "#0B0B0B", bands: 6 }, // Sassuolo
  18: { pattern: "solid", primary: "#7A1B22", accent: "#E0B64C" }, // Torino
  19: { pattern: "stripes", primary: "#111111", secondary: "#FFFFFF", bands: 7 }, // Udinese
  21: { pattern: "halves", primary: "#B4142E", secondary: "#12294B" }, // Cagliari
  107: { pattern: "sash", primary: "#F5D033", secondary: "#12294B" }, // Parma
  119: { pattern: "stripes", primary: "#F2C41D", secondary: "#B4142E", bands: 6 }, // Lecce
  138: { pattern: "solid", primary: "#0B0B0B", accent: "#E37B23" }, // Venezia
  143: { pattern: "solid", primary: "#C8102E", accent: "#FFFFFF" }, // Monza
  153: { pattern: "solid", primary: "#1B4C9B", accent: "#FFFFFF" }, // Como
};

const NEUTRAL: Kit = { pattern: "solid", primary: "#3A4663", accent: "#8E9AB7" };

export function kitFor(teamId: number): Kit {
  return KITS[teamId] ?? NEUTRAL;
}
