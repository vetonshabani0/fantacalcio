/**
 * The live feed encodes an event's half in the sign of its minute: negative for
 * the first half, positive for the second. Values beyond the end of a half are
 * stoppage time, so -48 is 45+3 and 96 is 90+6.
 */
export function minuteLabel(minute: number): string {
  const value = Math.abs(minute);
  const firstHalf = minute < 0;
  if (firstHalf) return value > 45 ? `45+${value - 45}'` : `${value}'`;
  return value > 90 ? `90+${value - 90}'` : `${value}'`;
}

/** Chronological sort key that keeps first-half events ahead of second-half ones. */
export function minuteOrder(minute: number): number {
  return minute < 0 ? Math.abs(minute) - 0.5 : minute;
}

/**
 * Match timestamps arrive as `2026-09-06T18:45:00`, with no zone marker.
 *
 * They are UTC, not Italian wall-clock time, which is easy to get backwards and
 * costly when you do: reading them as local shows every kickoff two hours early.
 * The giveaway is the slot distribution — a matchweek's times land on 13:00,
 * 16:00, 16:30 and 18:45, which are not Serie A slots, while the same times in
 * Europe/Rome are exactly the canonical 15:00, 18:00, 18:30 and 20:45. The
 * bucket's own `last-modified` agrees: it stops updating a matchweek's file
 * about two hours after the last of these, not four.
 */
export function kickoffDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Where Serie A kickoff times are quoted, wherever the reader happens to be. */
export const MATCH_TIMEZONE = "Europe/Rome";

/** The feed writes real formations without separators: "3421" -> "3-4-2-1". */
export function formatFormation(formation: string): string {
  if (!formation) return "";
  if (formation.includes("-")) return formation;
  return formation.split("").join("-");
}
