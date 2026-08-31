"use client";

import type { SerializedSide, SerializedSlot } from "@/lib/league-view";
import { useT } from "./LocaleProvider";
import { formatPoints } from "./ui";

/**
 * Splits a side's eleven into pitch rows following its module.
 *
 * Slots arrive in role order, and a module such as "3-4-2-1" spends its middle
 * numbers on midfielders, so those parts are consumed from the C pool in turn.
 * If a lineup and its module ever disagree, we fall back to one row per role.
 */
function rowsFor(side: SerializedSide): SerializedSlot[][] {
  const pool = (role: string) => side.slots.filter((s) => s.role === role);
  const keepers = pool("P");
  const defenders = pool("D");
  const midfielders = pool("C");
  const attackers = pool("A");

  const parts = side.formation.split("-").map(Number);
  const usable =
    parts.length >= 2 &&
    parts.every((n) => Number.isFinite(n) && n > 0) &&
    parts[0] === defenders.length &&
    parts[parts.length - 1] === attackers.length &&
    parts.slice(1, -1).reduce((a, b) => a + b, 0) === midfielders.length;

  if (!usable) {
    return [keepers, defenders, midfielders, attackers].filter(
      (row) => row.length > 0,
    );
  }

  const rows: SerializedSlot[][] = [keepers, defenders];
  let cursor = 0;
  for (const part of parts.slice(1, -1)) {
    rows.push(midfielders.slice(cursor, cursor + part));
    cursor += part;
  }
  rows.push(attackers);
  return rows.filter((row) => row.length > 0);
}

function Shirt({ slot, index }: { slot: SerializedSlot; index: number }) {
  const value = slot.void ? null : slot.fantavoto;
  const strong = value != null && value >= 7;
  const weak = value != null && value < 6;

  return (
    <div
      className="pop flex min-w-0 flex-1 flex-col items-center gap-1"
      style={{ animationDelay: `${0.03 * index}s` }}
    >
      <div
        className={`relative grid h-9 w-9 place-items-center rounded-full border md:h-11 md:w-11 ${
          slot.void
            ? "border-dashed border-white/22 bg-transparent"
            : strong
              ? "border-acid bg-acid text-ground"
              : weak
                ? "border-flare/35 bg-flare/[0.08] text-flare/90"
                : "border-white/25 bg-ground-3 text-ink"
        }`}
      >
        <span className="num text-[12px] font-extrabold md:text-[13px]">
          {value != null ? formatPoints(value) : "–"}
        </span>
        {slot.substitution ? (
          <span
            title={`Entrato al posto di ${slot.substitution.outName}`}
            className="absolute -right-1 -top-1 grid h-[15px] w-[15px] place-items-center rounded-full bg-acid text-[9px] font-black leading-none text-ground"
          >
            ↑
          </span>
        ) : null}
      </div>
      <span className="w-full truncate text-center text-[9.5px] leading-tight text-mute md:text-[10.5px]">
        {slot.name}
      </span>
    </div>
  );
}

export function Pitch({ side }: { side: SerializedSide }) {
  const t = useT();
  const rows = rowsFor(side);
  let index = 0;

  return (
    <div className="pitch overflow-hidden rounded-2xl border border-[var(--line)]">
      <div className="relative">
        {/* Markings stay faint so the shirts, not the pitch, carry the eye. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute inset-x-[26%] bottom-0 h-8 rounded-t border-x border-t border-white/[0.07]" />
        <div className="pointer-events-none absolute inset-x-[26%] top-0 h-8 rounded-b border-x border-b border-white/[0.07]" />

        <div className="relative flex flex-col-reverse gap-4 px-2.5 py-6 md:gap-5 md:px-4 md:py-7">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex items-start justify-center gap-1 md:gap-2"
            >
              {row.map((slot) => (
                <Shirt
                  key={`${slot.playerId}-${slot.role}`}
                  slot={slot}
                  index={index++}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-2">
        <span className="label">{side.formation}</span>
        <span className="label">
          {t("h2h.rated", { n: side.ratedSlots })}
          {side.substitutionsUsed > 0
            ? ` · ${t("h2h.subsUsed", { n: side.substitutionsUsed })}`
            : ""}
        </span>
      </div>
    </div>
  );
}
