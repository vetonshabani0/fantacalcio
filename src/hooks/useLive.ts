"use client";

import { useEffect, useRef, useState } from "react";

export interface LiveTick {
  version: number;
  matchweek: number;
  live: boolean;
  fetchedAt: number;
}

/**
 * Subscribes to the server's shared poller. The version counter only advances
 * when the upstream feed actually changed, so callers can use it directly as a
 * refetch trigger.
 */
export function useLiveVersion(): {
  tick: LiveTick | null;
  connected: boolean;
} {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/live/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveTick & { type: string };
        setConnected(true);
        setTick((previous) =>
          previous && previous.version === data.version
            ? { ...previous, fetchedAt: data.fetchedAt }
            : {
                version: data.version,
                matchweek: data.matchweek,
                live: data.live,
                fetchedAt: data.fetchedAt,
              },
        );
      } catch {
        // Ignore malformed frames; the next tick will resync.
      }
    };

    return () => source.close();
  }, []);

  return { tick, connected };
}

/**
 * Fetches `url` on mount and again whenever `version` changes. Keeps the last
 * good payload on screen while a refetch is in flight so the page never blanks.
 */
export function useLiveData<T>(
  url: string,
  version: number | undefined,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    setLoading(true);

    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `Errore ${res.status}`);
        return body as T;
      })
      .then((body) => {
        if (cancelled || id !== requestId.current) return;
        setData(body);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled || id !== requestId.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, version]);

  return { data, error, loading };
}

/**
 * Returns a flash class for one render pass whenever `value` changes, so the
 * cell can highlight green on a gain and red on a loss.
 */
export function useFlash(value: number | null | undefined): string {
  const previous = useRef<number | null | undefined>(undefined);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === undefined || before === null || value == null) return;
    if (value === before) return;

    setFlash(value > before ? "flash-up" : "flash-down");
    const timer = setTimeout(() => setFlash(""), 1700);
    return () => clearTimeout(timer);
  }, [value]);

  return flash;
}
