"use client";

import type { LineupSlot, MatchSide } from "@/lib/fanta/official";
import { Crest } from "./Crest";
import { useT } from "./LocaleProvider";
import { formatPoints } from "./ui";

type Side = MatchSide & { name: string; logo: string | null };

/**
 * Splits the starting eleven into pitch rows following the declared module.
 *
 * The slots arrive in role order, so "3-4-3" consumes 3 defenders, then 4
 * midfielders, then 3 attackers. If a lineup and its module ever disagree the
 * rows fall back to one per role, which still reads correctly.
 */
function rowsFor(side: Side): LineupSlot[][] {
  const pool = (role: string) => side.starters.filter((s) => s.role === role);
  const keepers = pool("P");
  const defenders = pool("D");
  const midfielders = pool("C");
  const attackers = pool("A");

  const parts = side.formation.split("-").map(Number);
  const usable =
    parts.length >= 3 &&
    parts.every((n) => Number.isFinite(n) && n > 0) &&
    parts[0] === defenders.length &&
    parts[parts.length - 1] === attackers.length &&
    parts.slice(1, -1).reduce((a, b) => a + b, 0) === midfielders.length;

  if (!usable) {
    return [keepers, defenders, midfielders, attackers].filter((r) => r.length);
  }

  const rows: LineupSlot[][] = [keepers, defenders];
  let cursor = 0;
  for (const part of parts.slice(1, -1)) {
    rows.push(midfielders.slice(cursor, cursor + part));
    cursor += part;
  }
  rows.push(attackers);
  return rows.filter((r) => r.length);
}

function Shirt({ slot, index }: { slot: LineupSlot; index: number }) {
  const t = useT();
  const value = slot.score;
  const strong = value != null && value >= 7;
  const weak = value != null && value < 6;
  const dropped = !slot.counted;

  return (
    <div
      className="pop flex min-w-0 flex-1 flex-col items-center gap-1"
      style={{ animationDelay: `${0.03 * index}s` }}
    >
      <div
        title={
          slot.swappedWith
            ? slot.status === "out"
              ? t("pitch.subOff", { name: slot.swappedWith })
              : t("pitch.subOn", { name: slot.swappedWith })
            : undefined
        }
        className={`relative grid h-9 w-9 place-items-center rounded-full border md:h-11 md:w-11 ${
          dropped
            ? "border-dashed border-white/25 bg-transparent text-faint"
            : strong
              ? "border-acid bg-acid text-ground"
              : weak
                ? "border-flare/40 bg-flare/[0.09] text-flare/90"
                : "border-white/25 bg-ground-3 text-ink"
        }`}
      >
        <span className="num text-[12px] font-extrabold md:text-[13px]">
          {value != null ? formatPoints(value) : "–"}
        </span>
        {slot.status === "out" ? (
          <span className="absolute -right-1 -top-1 grid h-[15px] w-[15px] place-items-center rounded-full bg-flare text-[9px] font-black leading-none text-ground">
            ↓
          </span>
        ) : null}
      </div>
      <span className="flex w-full items-center justify-center gap-1">
        {slot.clubId ? (
          <Crest teamId={slot.clubId} teamName={slot.club} size="sm" eager />
        ) : null}
        <span className="truncate text-[9.5px] leading-tight text-mute md:text-[10.5px]">
          {slot.name}
        </span>
      </span>
    </div>
  );
}

export function LineupPitch({ side }: { side: Side }) {
  const t = useT();
  const rows = rowsFor(side);
  let index = 0;

  const cameOn = side.bench.filter((b) => b.status === "in");

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          {side.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={side.logo} alt="" aria-hidden className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : null}
          <span className="truncate text-[14px] font-semibold">{side.name}</span>
        </span>
        <span className="num shrink-0 text-[18px] font-extrabold">
          {formatPoints(side.total)}
        </span>
      </div>

      <div className="pitch relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute inset-x-[26%] bottom-0 h-8 rounded-t border-x border-t border-white/[0.07]" />
        <div className="pointer-events-none absolute inset-x-[26%] top-0 h-8 rounded-b border-x border-b border-white/[0.07]" />

        <div className="relative flex flex-col-reverse gap-4 px-2 py-6 md:gap-5 md:px-3 md:py-7">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start justify-center gap-1 md:gap-2">
              {row.map((slot) => (
                <Shirt key={slot.playerId} slot={slot} index={index++} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-3 py-2">
        <span className="label">
          {t("pitch.module")} {side.formation}
          {side.formationAfterSubs !== side.formation
            ? ` → ${side.formationAfterSubs}`
            : ""}
        </span>
        <span className="label">
          {side.points} {side.points === 1 ? "pt" : "pts"}
        </span>
      </div>

      {cameOn.length ? (
        <div className="border-t border-[var(--line)] px-3 py-2.5">
          <p className="label pb-1.5">{t("pitch.bench")}</p>
          {cameOn.map((slot) => (
            <div
              key={slot.playerId}
              className="flex items-center gap-2 py-1 text-[12px]"
            >
              <span className="text-acid">↑</span>
              <span className="min-w-0 flex-1 truncate">
                {slot.name}
                {slot.swappedWith ? (
                  <span className="text-faint">
                    {" "}
                    · {t("pitch.subOn", { name: slot.swappedWith })}
                  </span>
                ) : null}
              </span>
              <span className="num shrink-0 font-bold">
                {slot.score != null ? formatPoints(slot.score) : "–"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
