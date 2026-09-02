"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { BoardPlayer } from "@/lib/api-types";
import type { RealMatch } from "@/lib/fanta/types";
import { PlayerRow, PlayerRowHeader } from "./PlayerRow";
import { Crest } from "./Crest";
import { useT } from "./LocaleProvider";
import { Empty, Role, Segmented } from "./ui";

const ROLE_ORDER: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 };

function squad(players: BoardPlayer[], teamId: number): BoardPlayer[] {
  return players
    .filter((p) => p.teamId === teamId)
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name),
    );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="label border-b border-[var(--line)] pb-1.5 pt-6">{children}</p>
  );
}

/**
 * Before kickoff there are no ratings, so the useful thing the feed carries is
 * the probable-lineup percentage.
 */
function Probable({
  players,
  onSelect,
}: {
  players: BoardPlayer[];
  onSelect: (player: BoardPlayer) => void;
}) {
  const t = useT();
  const ranked = [...players].sort(
    (a, b) =>
      b.startProbability - a.startProbability ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
  );

  if (ranked.length === 0) {
    return <Empty>{t("squad.noCallups")}</Empty>;
  }

  return (
    <div>
      <p className="label border-b border-[var(--line)] pb-1.5">
        {t("squad.probableLineup")}
      </p>
      {ranked.map((player) => (
        <button
          key={player.id}
          onClick={() => onSelect(player)}
          className="flex w-full items-center gap-3 border-b border-[var(--line-soft)] py-2.5 text-left"
        >
          <Role role={player.role} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
            {player.name}
          </span>
          <span className="h-[3px] w-14 shrink-0 overflow-hidden rounded-full bg-fill">
            <span
              style={
                {
                  "--grow": player.startProbability / 100,
                } as React.CSSProperties
              }
              className={`grow-x block h-full rounded-full ${
                player.startProbability >= 100 ? "bg-acid" : "bg-[var(--edge-strong)]"
              }`}
            />
          </span>
          <span
            className={`num w-9 shrink-0 text-right text-[12px] ${
              player.startProbability >= 100 ? "text-acid" : "text-faint"
            }`}
          >
            {player.startProbability}%
          </span>
        </button>
      ))}
    </div>
  );
}

function Squad({
  players,
  onSelect,
}: {
  players: BoardPlayer[];
  onSelect: (player: BoardPlayer) => void;
}) {
  const t = useT();
  const [showUnused, setShowUnused] = useState(false);
  const incomingFor = new Map<number, BoardPlayer>();
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const p of players) {
    if (p.replacedPlayerId) incomingFor.set(p.replacedPlayerId, p);
  }

  const started = players.filter((p) => !p.replacedPlayerId);
  const camein = players.filter((p) => p.replacedPlayerId);
  const unused = started.filter(
    (p) => !p.hasVote && !incomingFor.has(p.id),
  );
  const xi = started.filter((p) => !unused.includes(p));

  if (xi.length === 0 && camein.length === 0) {
    return <Empty>{t("squad.lineupPending")}</Empty>;
  }

  return (
    <div>
      <PlayerRowHeader />
      {xi.map((player) => (
        <PlayerRow
          key={player.id}
          player={player}
          replacedBy={incomingFor.get(player.id)}
          onSelect={() => onSelect(player)}
        />
      ))}

      {camein.length ? (
        <>
          <GroupLabel>{t("squad.subbedOn")}</GroupLabel>
          {camein.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              replaces={
                player.replacedPlayerId
                  ? byId.get(player.replacedPlayerId)
                  : undefined
              }
              onSelect={() => onSelect(player)}
            />
          ))}
        </>
      ) : null}

      {unused.length ? (
        <>
          <button
            onClick={() => setShowUnused((v) => !v)}
            className="tap label flex w-full items-center justify-between border-b border-[var(--line)] pb-1.5 pt-6 hover:!text-ink"
          >
            <span>{t("squad.unused", { n: unused.length })}</span>
            <span>{showUnused ? t("squad.hide") : t("squad.show")}</span>
          </button>
          {showUnused
            ? unused.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  dim
                  onSelect={() => onSelect(player)}
                />
              ))
            : null}
        </>
      ) : null}
    </div>
  );
}

export function MatchDetail({
  match,
  players,
  onSelectPlayer,
}: {
  match: RealMatch;
  players: BoardPlayer[];
  onSelectPlayer: (player: BoardPlayer) => void;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const played = match.state !== "pre-match";

  // Reset to the home side whenever a different fixture is opened.
  useEffect(() => setSide("home"), [match.id]);

  const home = squad(players, match.homeTeamId);
  const away = squad(players, match.awayTeamId);

  const Column = ({ list }: { list: BoardPlayer[] }) =>
    played ? (
      <Squad players={list} onSelect={onSelectPlayer} />
    ) : (
      <Probable players={list} onSelect={onSelectPlayer} />
    );

  return (
    <>
      {/* Phones: one side at a time, switched with a segmented control. */}
      <div className="gutter md:hidden">
        <div className="mx-auto max-w-sm">
          <Segmented
            value={side}
            onChange={setSide}
            options={[
              { value: "home", label: match.homeTeamName },
              { value: "away", label: match.awayTeamName },
            ]}
          />
        </div>
        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={side}
              initial={{ opacity: 0, x: side === "home" ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: side === "home" ? 16 : -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Column list={side === "home" ? home : away} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Wider screens show both squads side by side. */}
      <div className="gutter hidden gap-12 md:grid md:grid-cols-2">
        {[
          {
            id: match.homeTeamId,
            name: match.homeTeamName,
            goals: match.homeGoals,
            list: home,
          },
          {
            id: match.awayTeamId,
            name: match.awayTeamName,
            goals: match.awayGoals,
            list: away,
          },
        ].map((column) => (
          <div key={column.name}>
            <div className="flex items-center justify-between gap-3 pb-3">
              <h3 className="display-tight flex items-center gap-2.5 text-[20px]">
                <Crest teamId={column.id} teamName={column.name} size="lg" />
                {column.name}
              </h3>
              <span className="num text-[26px] font-extrabold">
                {played ? column.goals : "–"}
              </span>
            </div>
            <Column list={column.list} />
          </div>
        ))}
      </div>
    </>
  );
}
