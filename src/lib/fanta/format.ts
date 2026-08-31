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

/** The feed writes real formations without separators: "3421" -> "3-4-2-1". */
export function formatFormation(formation: string): string {
  if (!formation) return "";
  if (formation.includes("-")) return formation;
  return formation.split("").join("-");
}
