"use client";

import { motion } from "motion/react";
import { minuteLabel } from "@/lib/fanta/format";
import { EVENT_GLYPH } from "@/lib/fanta/rules";
import type { EventKind } from "@/lib/fanta/types";
import type { BoardPlayer } from "@/lib/api-types";
import { useFlash } from "@/hooks/useLive";
import { useT } from "./LocaleProvider";
import { formatPoints, Role } from "./ui";

const POSITIVE: EventKind[] = [
  "scoredGoals",
  "scoredPenalties",
  "savedPenalties",
  "assists",
  "softAssists",
  "goldAssists",
];
const NEGATIVE: EventKind[] = [
  "redCards",
  "ownGoals",
  "missedPenalties",
  "concededGoals",
];

function tone(kind: EventKind): string {
  if (POSITIVE.includes(kind)) return "text-acid";
  if (NEGATIVE.includes(kind)) return "text-flare";
  if (kind === "yellowCards") return "text-gold";
  if (kind === "subbedIn") return "text-acid-dim";
  if (kind === "subbedOut") return "text-flare/60";
  if (kind === "manOfTheMatch") return "text-gold";
  return "text-faint";
}

export function EventChips({
  events,
  className = "",
}: {
  events: { kind: EventKind; minute: number }[];
  className?: string;
}) {
  const t = useT();
  if (events.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {events.map((event, i) => (
        <span
          key={`${event.kind}-${i}`}
          title={`${t(`event.${event.kind}`)} · ${minuteLabel(event.minute)}`}
          className={`inline-flex items-baseline gap-0.5 text-[11px] leading-none ${tone(event.kind)}`}
        >
          <span aria-hidden>{EVENT_GLYPH[event.kind] ?? "•"}</span>
          <span className="num text-[9.5px] opacity-65">
            {minuteLabel(event.minute)}
          </span>
        </span>
      ))}
    </span>
  );
}

export function PlayerRow({
  player,
  replacedBy,
  replaces,
  dim = false,
  onSelect,
}: {
  player: BoardPlayer;
  replacedBy?: BoardPlayer;
  replaces?: BoardPlayer;
  dim?: boolean;
  onSelect?: () => void;
}) {
  const flash = useFlash(player.fantavoto);

  return (
    <motion.button
      onClick={onSelect}
      whileTap={onSelect ? { scale: 0.99 } : undefined}
      className={`flex w-full items-center gap-3 border-b border-[var(--line-soft)] py-2.5 text-left ${flash} ${
        dim ? "opacity-45" : ""
      }`}
    >
      <Role role={player.role} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-medium">
            {player.name}
          </span>
          {replaces ? (
            <span className="shrink-0 text-[10px] text-faint">
              ↑ {replaces.name}
            </span>
          ) : null}
          {replacedBy ? (
            <span className="shrink-0 text-[10px] text-faint">
              ↓ {replacedBy.name}
            </span>
          ) : null}
        </span>
        <EventChips events={player.events} className="mt-1" />
      </span>

      <span className="flex shrink-0 items-baseline gap-3">
        <span
          className={`num w-10 text-right text-[13px] ${
            player.hasVote ? "text-mute" : "text-faint"
          }`}
        >
          {player.grade != null ? formatPoints(player.grade) : "sv"}
        </span>
        <span
          className={`num w-12 text-right text-[17px] font-extrabold ${
            !player.hasVote
              ? "text-faint"
              : player.bonus > 0
                ? "text-acid"
                : player.bonus < 0
                  ? "text-flare"
                  : "text-ink"
          }`}
        >
          {player.fantavoto != null ? formatPoints(player.fantavoto) : "—"}
        </span>
      </span>
    </motion.button>
  );
}

export function PlayerRowHeader() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
      <span className="w-3" />
      <span className="label flex-1">{t("squad.player")}</span>
      <span className="label w-10 shrink-0 truncate text-right !tracking-normal">
        {t("squad.grade")}
      </span>
      <span className="label w-12 shrink-0 truncate text-right !tracking-normal">
        {t("squad.fanta")}
      </span>
    </div>
  );
}
