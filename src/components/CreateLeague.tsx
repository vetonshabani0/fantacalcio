"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DemoButton } from "./DemoButton";
import { Loading, Reveal, Role, Section } from "./ui";

interface IndexedPlayer {
  id: number;
  name: string;
  role: "P" | "D" | "C" | "A";
  teamId: number;
  teamName: string;
}

interface TeamDraft {
  name: string;
  manager: string;
  roster: number[];
}

const ROLES: IndexedPlayer["role"][] = ["P", "D", "C", "A"];
const ROLE_TARGET: Record<IndexedPlayer["role"], number> = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

function emptyTeam(): TeamDraft {
  return { name: "", manager: "", roster: [] };
}

const field =
  "w-full border-b border-[var(--line)] bg-transparent pb-2 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-acid";

export function CreateLeague() {
  const router = useRouter();
  const [players, setPlayers] = useState<IndexedPlayer[] | null>(null);
  const [name, setName] = useState("");
  const [teams, setTeams] = useState<TeamDraft[]>([emptyTeam(), emptyTeam()]);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<IndexedPlayer["role"] | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/players?limit=300")
      .then((res) => res.json())
      .then((body: { players: IndexedPlayer[] }) => setPlayers(body.players))
      .catch(() => setError("Impossibile caricare la lista giocatori."));
  }, []);

  const byId = useMemo(
    () => new Map((players ?? []).map((p) => [p.id, p])),
    [players],
  );

  // A player can only belong to one team, as in a real auction.
  const owner = useMemo(() => {
    const map = new Map<number, number>();
    teams.forEach((team, index) => {
      for (const id of team.roster) map.set(id, index);
    });
    return map;
  }, [teams]);

  const visible = useMemo(() => {
    if (!players) return [];
    const needle = query.trim().toLowerCase();
    return players
      .filter((p) => (roleFilter ? p.role === roleFilter : true))
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          p.teamName.toLowerCase().includes(needle),
      )
      .slice(0, 150);
  }, [players, query, roleFilter]);

  const updateTeam = (index: number, patch: Partial<TeamDraft>) =>
    setTeams((current) =>
      current.map((team, i) => (i === index ? { ...team, ...patch } : team)),
    );

  function togglePlayer(id: number) {
    setTeams((current) =>
      current.map((team, i) => {
        if (i !== active) {
          return team.roster.includes(id)
            ? { ...team, roster: team.roster.filter((p) => p !== id) }
            : team;
        }
        return team.roster.includes(id)
          ? { ...team, roster: team.roster.filter((p) => p !== id) }
          : { ...team, roster: [...team.roster, id] };
      }),
    );
  }

  /** Fills every team up to the standard 3-8-8-6 shape from what is still free. */
  function autoFill() {
    if (!players) return;
    setTeams((current) => {
      const used = new Set(current.flatMap((t) => t.roster));
      const pools: Record<string, IndexedPlayer[]> = {
        P: [],
        D: [],
        C: [],
        A: [],
      };
      for (const player of players) {
        if (!used.has(player.id)) pools[player.role].push(player);
      }

      const next = current.map((team) => ({
        ...team,
        roster: [...team.roster],
      }));
      for (const role of ROLES) {
        const pool = pools[role];
        let cursor = 0;
        let round = 0;
        let progressed = true;
        while (progressed && round < ROLE_TARGET[role]) {
          progressed = false;
          const order = round % 2 === 0 ? next : [...next].reverse();
          for (const team of order) {
            const have = team.roster.filter(
              (id) => byId.get(id)?.role === role,
            ).length;
            if (have >= ROLE_TARGET[role]) continue;
            const pick = pool[cursor++];
            if (!pick) break;
            team.roster.push(pick.id);
            progressed = true;
          }
          round++;
        }
      }
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Dai un nome alla lega.");

    const named = teams.map((team, i) => ({
      ...team,
      name: team.name.trim() || `Squadra ${i + 1}`,
    }));
    const short = named.find((team) => team.roster.length < 11);
    if (short) {
      return setError(
        `"${short.name}" ha ${short.roster.length} giocatori: ne servono almeno 11.`,
      );
    }

    setSaving(true);
    try {
      const res = await fetch("/api/league", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), teams: named }),
      });
      const body = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !body.code) {
        setError(body.error ?? "Creazione non riuscita.");
        return;
      }
      router.push(`/lega/${body.code}`);
    } finally {
      setSaving(false);
    }
  }

  const current = teams[active];
  const countIn = (team: TeamDraft, role: IndexedPlayer["role"]) =>
    team.roster.filter((id) => byId.get(id)?.role === role).length;

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <p className="label">Nuova lega</p>
          <h1 className="display mt-3 text-[clamp(40px,11vw,84px)]">
            Costruisci
            <br />
            la tua lega
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-mute">
            Crea le squadre e assegna le rose con i giocatori reali della Serie
            A. Da lì in poi classifica, sfide e sostituzioni si aggiornano da
            sole.{" "}
            <DemoButton className="font-semibold text-acid">
              Oppure parti da una lega dimostrativa →
            </DemoButton>
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 max-w-xl">
            <p className="label mb-2">Nome della lega</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Lega degli Amici"
              className={field}
            />
          </div>
        </Reveal>
      </section>

      <section className="pt-14">
        <Section
          title="Squadre"
          hint="Almeno due. Il calendario è andata e ritorno."
          right={
            <div className="flex gap-2">
              <button
                onClick={() => setTeams((t) => [...t, emptyTeam()])}
                className="tap label rounded-full border border-[var(--line)] px-3 py-1.5 hover:!text-ink"
              >
                + Squadra
              </button>
              <button
                onClick={autoFill}
                disabled={!players}
                className="tap label rounded-full border border-acid/40 bg-acid/10 px-3 py-1.5 !text-acid disabled:opacity-30"
              >
                Completa rose
              </button>
            </div>
          }
        />

        <div className="rail mt-5">
          {teams.map((team, index) => {
            const complete = team.roster.length >= 11;
            return (
              <button
                key={index}
                onClick={() => setActive(index)}
                className={`tap rounded-full border px-4 py-2 ${
                  index === active
                    ? "border-acid bg-acid text-ground"
                    : "border-[var(--line)] text-mute"
                }`}
              >
                <span className="text-[13px] font-semibold">
                  {team.name.trim() || `Squadra ${index + 1}`}
                </span>
                <span
                  className={`num ml-2 text-[12px] ${
                    index === active
                      ? "text-ground/70"
                      : complete
                        ? "text-acid"
                        : "text-faint"
                  }`}
                >
                  {team.roster.length}
                </span>
              </button>
            );
          })}
          {teams.length > 2 ? (
            <button
              onClick={() => {
                setTeams((t) => t.filter((_, i) => i !== active));
                setActive(0);
              }}
              className="tap label rounded-full border border-flare/35 px-4 py-2 !text-flare"
            >
              Rimuovi
            </button>
          ) : null}
        </div>

        <div className="gutter mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div>
            <p className="label mb-2">Nome squadra</p>
            <input
              value={current.name}
              onChange={(e) => updateTeam(active, { name: e.target.value })}
              placeholder={`Squadra ${active + 1}`}
              className={field}
            />
          </div>
          <div>
            <p className="label mb-2">Nome del manager</p>
            <input
              value={current.manager}
              onChange={(e) => updateTeam(active, { manager: e.target.value })}
              placeholder="Come ti cercheranno"
              className={field}
            />
          </div>
        </div>

        <div className="gutter mt-5 flex flex-wrap gap-4">
          {ROLES.map((role) => (
            <span key={role} className="flex items-center gap-1.5">
              <Role role={role} />
              <span className="num text-[12px] text-mute">
                {countIn(current, role)}/{ROLE_TARGET[role]}
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="pt-14">
        <Section
          title="Rosa"
          hint="Un giocatore può stare in una sola squadra"
        />

        <div className="gutter mt-5 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore o club"
            className="min-w-[180px] flex-1 border-b border-[var(--line)] bg-transparent pb-2 text-[15px] outline-none placeholder:text-faint focus:border-acid"
          />
          <div className="flex gap-1.5">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter((r) => (r === role ? null : role))}
                className={`tap num h-9 w-9 rounded-full border text-[12px] font-bold ${
                  roleFilter === role
                    ? "border-acid bg-acid text-ground"
                    : "border-[var(--line)] text-mute"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {!players ? (
          <Loading label="Carico i giocatori" />
        ) : (
          <div className="gutter mt-4 grid max-h-[26rem] grid-cols-1 gap-x-8 overflow-y-auto overscroll-contain no-scrollbar sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((player) => {
              const holder = owner.get(player.id);
              const mine = holder === active;
              const other =
                holder != null && holder !== active
                  ? teams[holder].name.trim() || `Squadra ${holder + 1}`
                  : null;
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className="flex items-center gap-2.5 border-b border-[var(--line-soft)] py-2.5 text-left"
                >
                  <Role role={player.role} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[14px] font-medium ${
                        mine ? "text-acid" : ""
                      }`}
                    >
                      {player.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-faint">
                      {player.teamName}
                      {other ? ` · ${other}` : ""}
                    </span>
                  </span>
                  <span
                    className={`text-[15px] ${mine ? "text-acid" : "text-faint/50"}`}
                  >
                    {mine ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="gutter sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-8 pt-4 md:bottom-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-ground-2/95 px-4 py-3 backdrop-blur">
          <AnimatePresence mode="wait">
            <motion.span
              key={error ?? "ok"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`min-w-0 flex-1 text-[12px] leading-snug ${error ? "text-flare" : "text-faint"}`}
            >
              {error ?? "Riceverai un codice da condividere"}
            </motion.span>
          </AnimatePresence>
          <button
            onClick={submit}
            disabled={saving}
            className="tap shrink-0 rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-ground disabled:opacity-30"
          >
            {saving ? "Creo…" : "Crea lega"}
          </button>
        </div>
      </div>
    </>
  );
}
