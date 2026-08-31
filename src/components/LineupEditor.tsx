"use client";

import { useEffect, useMemo, useState } from "react";
import { parseFormation } from "@/lib/fanta/rules";
import type { Role as RoleKey } from "@/lib/fanta/types";
import { formatPoints, Loading, Role, Sheet } from "./ui";

interface RosterPlayer {
  id: number;
  name: string;
  role: RoleKey;
  teamName: string;
  grade: number | null;
  fantavoto: number | null;
  hasVote: boolean;
  startProbability: number;
  matchState: string;
}

interface Payload {
  teamId: string;
  teamName: string;
  matchweek: number;
  lineup: { formation: string; starters: number[]; bench: number[] };
  auto: boolean;
  roster: RosterPlayer[];
  formations: string[];
  locked: boolean;
}

const ROLE_ORDER: Record<RoleKey, number> = { P: 0, D: 1, C: 2, A: 3 };
const ROLES: RoleKey[] = ["P", "D", "C", "A"];

export function LineupEditor({
  code,
  teamId,
  matchweek,
  onClose,
  onSaved,
}: {
  code: string;
  teamId: string;
  matchweek: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [formation, setFormation] = useState("");
  const [starters, setStarters] = useState<number[]>([]);
  const [bench, setBench] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/league/${code}/lineup?teamId=${teamId}&matchweek=${matchweek}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Errore");
        return body as Payload;
      })
      .then((body) => {
        setPayload(body);
        setFormation(body.lineup.formation);
        setStarters(body.lineup.starters);
        setBench(body.lineup.bench);
      })
      .catch((err: Error) => setError(err.message));
  }, [code, teamId, matchweek]);

  const byId = useMemo(
    () => new Map((payload?.roster ?? []).map((p) => [p.id, p])),
    [payload],
  );

  const need = useMemo(
    () => (formation ? parseFormation(formation) : null),
    [formation],
  );

  const have = useMemo(() => {
    const counts: Record<RoleKey, number> = { P: 0, D: 0, C: 0, A: 0 };
    for (const id of starters) {
      const role = byId.get(id)?.role;
      if (role) counts[role]++;
    }
    return counts;
  }, [starters, byId]);

  const valid =
    !!need &&
    starters.length === 11 &&
    ROLES.every((role) => have[role] === need[role]);

  const toStarter = (id: number) => {
    setBench((b) => b.filter((x) => x !== id));
    setStarters((s) => (s.includes(id) ? s : [...s, id]));
  };

  const toBench = (id: number) => {
    setStarters((s) => s.filter((x) => x !== id));
    setBench((b) => (b.includes(id) ? b : [...b, id]));
  };

  const moveBench = (index: number, delta: number) =>
    setBench((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/league/${code}/lineup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId,
          matchweek,
          lineup: { formation, starters, bench },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Salvataggio non riuscito");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const sorted = (ids: number[]) =>
    [...ids].sort((a, b) => {
      const pa = byId.get(a);
      const pb = byId.get(b);
      if (!pa || !pb) return 0;
      return ROLE_ORDER[pa.role] - ROLE_ORDER[pb.role];
    });

  const Line = ({
    id,
    action,
    index,
  }: {
    id: number;
    action: "bench" | "start";
    index?: number;
  }) => {
    const player = byId.get(id);
    if (!player) return null;
    return (
      <div className="flex items-center gap-2.5 border-b border-[var(--line-soft)] py-2">
        {index != null ? (
          <span className="num w-4 shrink-0 text-[11px] text-faint">
            {index + 1}
          </span>
        ) : null}
        <Role role={player.role} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">
            {player.name}
          </span>
          <span className="block truncate text-[10.5px] text-faint">
            {player.teamName} ·{" "}
            {player.hasVote
              ? `voto ${formatPoints(player.grade ?? 0)}`
              : player.matchState === "pre-match"
                ? `titolare al ${player.startProbability}%`
                : "senza voto"}
          </span>
        </span>
        <span
          className={`num w-9 shrink-0 text-right text-[14px] font-bold ${
            player.hasVote ? "text-ink" : "text-faint"
          }`}
        >
          {player.fantavoto != null ? formatPoints(player.fantavoto) : "—"}
        </span>
        {index != null ? (
          <span className="flex shrink-0 flex-col">
            <button
              onClick={() => moveBench(index, -1)}
              aria-label="Sposta su"
              className="h-3.5 px-1 text-[8px] leading-none text-faint hover:text-ink"
            >
              ▲
            </button>
            <button
              onClick={() => moveBench(index, 1)}
              aria-label="Sposta giù"
              className="h-3.5 px-1 text-[8px] leading-none text-faint hover:text-ink"
            >
              ▼
            </button>
          </span>
        ) : null}
        <button
          onClick={() => (action === "bench" ? toBench(id) : toStarter(id))}
          className="tap label shrink-0 rounded-full border border-[var(--line)] px-2 py-1 !text-[9px] hover:!text-ink"
        >
          {action === "bench" ? "Panca" : "Titolare"}
        </button>
      </div>
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div className="min-w-0">
          <p className="label">Formazione · giornata {matchweek}</p>
          <h3 className="display-tight mt-1 truncate text-[22px]">
            {payload?.teamName ?? "…"}
          </h3>
        </div>
      }
    >
      {!payload ? (
        error ? (
          <p className="px-5 py-10 text-center text-[13px] text-flare">
            {error}
          </p>
        ) : (
          <Loading />
        )
      ) : (
        <div className="px-5">
          <p className="border-y border-[var(--line)] py-3 text-[12px] leading-relaxed text-mute">
            L&apos;ordine della panchina decide chi entra al posto di chi resta
            senza voto.
          </p>

          <div className="flex flex-wrap items-center gap-3 py-3">
            <label className="flex items-center gap-2">
              <span className="label">Modulo</span>
              <select
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                className="num rounded-full border border-[var(--line)] bg-ground-3 px-3 py-1.5 text-[13px] font-bold text-ink outline-none"
              >
                {payload.formations.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {need
              ? ROLES.map((role) => (
                  <span key={role} className="flex items-center gap-1">
                    <Role role={role} />
                    <span
                      className={`num text-[12px] ${
                        have[role] === need[role] ? "text-mute" : "text-gold"
                      }`}
                    >
                      {have[role]}/{need[role]}
                    </span>
                  </span>
                ))
              : null}
          </div>

          <p className="label border-t border-[var(--line)] pb-1.5 pt-4">
            Titolari · {starters.length}/11
          </p>
          {sorted(starters).map((id) => (
            <Line key={id} id={id} action="bench" />
          ))}

          <p className="label pb-1.5 pt-6">Panchina · ordine di ingresso</p>
          {bench.map((id, index) => (
            <Line key={id} id={id} action="start" index={index} />
          ))}

          {error ? (
            <p className="pt-4 text-[13px] text-flare">{error}</p>
          ) : null}

          <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-between gap-4 border-t border-[var(--line)] bg-ground-2/95 px-5 py-4 backdrop-blur">
            <span className="text-[12px] text-faint">
              {valid ? "Formazione valida" : "Completa il modulo"}
            </span>
            <button
              onClick={save}
              disabled={!valid || saving}
              className="tap rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-ground disabled:opacity-30"
            >
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
