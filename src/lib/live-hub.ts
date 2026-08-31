import {
  getCurrentSnapshot,
  isLiveNow,
  isNearKickoff,
  resolvePointer,
} from "./fanta/source";
import type { LiveSnapshot } from "./fanta/types";

/**
 * A single server-side poller shared by every connected client.
 *
 * The upstream bucket is a static CDN object, so one poll serves all viewers.
 * Clients subscribe over SSE and are only woken when the payload actually
 * changes, which keeps idle tabs silent between matchweeks.
 */

type Listener = (event: HubEvent) => void;

export interface HubEvent {
  type: "snapshot" | "heartbeat";
  version: number;
  seasonId: number;
  matchweek: number;
  live: boolean;
  fetchedAt: number;
}

const INTERVAL_LIVE = 10_000;
const INTERVAL_KICKOFF = 20_000;
const INTERVAL_IDLE = 120_000;

interface HubState {
  listeners: Set<Listener>;
  timer: NodeJS.Timeout | null;
  version: number;
  fingerprint: string;
  last: HubEvent | null;
  polling: boolean;
}

// Survives dev-server hot reloads, which would otherwise leak pollers.
const globalKey = Symbol.for("fantalive.hub");
const globalScope = globalThis as unknown as Record<symbol, HubState | undefined>;

function hub(): HubState {
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = {
      listeners: new Set(),
      timer: null,
      version: 0,
      fingerprint: "",
      last: null,
      polling: false,
    };
  }
  return globalScope[globalKey]!;
}

/**
 * Everything that can change during a matchweek, flattened. Comparing this
 * rather than the whole payload avoids waking clients on timestamp churn.
 */
function fingerprintOf(snapshot: LiveSnapshot): string {
  const matches = snapshot.matches
    .map((m) => `${m.id}:${m.homeGoals}-${m.awayGoals}:${m.state}`)
    .join("|");
  const players = snapshot.players
    .map((p) => `${p.id}:${p.grade ?? ""}:${p.events.length}:${p.onField ? 1 : 0}`)
    .join("|");
  return `${snapshot.matchweek}#${matches}#${players}`;
}

function intervalFor(snapshot: LiveSnapshot | null): number {
  if (isLiveNow(snapshot)) return INTERVAL_LIVE;
  if (isNearKickoff(snapshot)) return INTERVAL_KICKOFF;
  return INTERVAL_IDLE;
}

async function poll(): Promise<void> {
  const state = hub();
  if (state.polling) return;
  state.polling = true;

  let snapshot: LiveSnapshot | null = null;
  try {
    snapshot = await getCurrentSnapshot();
    if (snapshot) {
      const fingerprint = fingerprintOf(snapshot);
      if (fingerprint !== state.fingerprint) {
        state.fingerprint = fingerprint;
        state.version++;
        const event: HubEvent = {
          type: "snapshot",
          version: state.version,
          seasonId: snapshot.seasonId,
          matchweek: snapshot.matchweek,
          live: isLiveNow(snapshot),
          fetchedAt: snapshot.fetchedAt,
        };
        state.last = event;
        for (const listener of state.listeners) listener(event);
      } else if (state.last) {
        for (const listener of state.listeners) {
          listener({ ...state.last, type: "heartbeat", fetchedAt: Date.now() });
        }
      }
    }
  } catch {
    // A failed poll is not fatal; the next tick retries.
  } finally {
    state.polling = false;
  }

  schedule(intervalFor(snapshot));
}

function schedule(delay: number): void {
  const state = hub();
  if (state.timer) clearTimeout(state.timer);
  if (state.listeners.size === 0) {
    state.timer = null;
    return;
  }
  state.timer = setTimeout(poll, delay);
  // Never hold the process open for a poll.
  state.timer.unref?.();
}

export function subscribe(listener: Listener): () => void {
  const state = hub();
  state.listeners.add(listener);

  if (state.last) listener(state.last);
  if (!state.timer) void poll();

  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0 && state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };
}

export async function currentVersion(): Promise<number> {
  const state = hub();
  if (state.version === 0) {
    await resolvePointer();
    await poll();
  }
  return state.version;
}
