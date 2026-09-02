"use client";

import type { ImportedFixture } from "./fanta/calendar-import";

/**
 * An imported calendar lives in the browser, not on the server.
 *
 * Serverless instances share no filesystem, so anything written server-side
 * would disappear for the next request. Keeping it here also means the file a
 * league member exports never has to be stored by anyone else.
 */
const key = (alias: string) => `fantalive.calendar.${alias}`;

export function loadCalendar(alias: string): ImportedFixture[] | null {
  try {
    const raw = window.localStorage.getItem(key(alias));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportedFixture[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCalendar(alias: string, fixtures: ImportedFixture[]): void {
  try {
    window.localStorage.setItem(key(alias), JSON.stringify(fixtures));
  } catch {
    // Storage can be unavailable or full; the calendar is a convenience.
  }
}

export function clearCalendar(alias: string): void {
  try {
    window.localStorage.removeItem(key(alias));
  } catch {
    // Nothing to do.
  }
}
