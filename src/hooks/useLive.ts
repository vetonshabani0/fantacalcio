"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLiveBoard, pollInterval } from "@/lib/live-client";
import type { LiveBoard } from "@/lib/api-types";

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
export function useLiveVersion(disabled = false): {
  tick: LiveTick | null;
  connected: boolean;
} {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (disabled) return;
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
  }, [disabled]);

  return { tick, connected };
}

/**
 * Fetches `url` on mount and again whenever `version` changes. Keeps the last
 * good payload on screen while a refetch is in flight so the page never blanks.
 */
export function useLiveData<T>(
  url: string | null,
  version: number | undefined,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    if (!url) return;
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

/**
 * The live board, from whichever source this build has.
 *
 * With a server it subscribes to the shared poller over SSE and refetches
 * `/api/live` on a version change. In the static build there is no server, so
 * it polls the public feed directly from the browser and does the decoding and
 * scoring client-side.
 */
export function useLiveBoard(): {
  data: LiveBoard | null;
  error: string | null;
  loading: boolean;
  connected: boolean;
} {
  const isStatic = process.env.NEXT_PUBLIC_STATIC === "1";

  const { tick, connected } = useLiveVersion(isStatic);
  const server = useLiveData<LiveBoard>(
    isStatic ? null : "/api/live",
    tick?.version,
  );

  const [direct, setDirect] = useState<{
    data: LiveBoard | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: isStatic });

  useEffect(() => {
    if (!isStatic) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      try {
        const board = await fetchLiveBoard();
        if (cancelled) return;
        setDirect({ data: board, error: null, loading: false });
        timer = setTimeout(run, pollInterval(board));
      } catch (err) {
        if (cancelled) return;
        setDirect((prev) => ({
          data: prev.data,
          error: err instanceof Error ? err.message : "Errore",
          loading: false,
        }));
        timer = setTimeout(run, 30_000);
      }
    };

    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isStatic]);

  if (isStatic) return { ...direct, connected: true };
  return { ...server, connected };
}
