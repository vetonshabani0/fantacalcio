"use client";

import type { LineupSlot } from "@/lib/fanta/official";
import { Jersey } from "./Jersey";
import { useT } from "./LocaleProvider";
import { formatPoints } from "./ui";

/**
 * A player on the pitch: club shirt, surname, and the score that counted.
 *
 * Reads at a glance the way a team sheet should — the shirt identifies the club
 * without a crest to squint at, and the score sits in its own bar rather than
 * inside the graphic.
 */
export function PlayerCard({
  slot,
  index,
}: {
  slot: LineupSlot;
  index: number;
}) {
  const t = useT();
  const value = slot.score;
  const dropped = !slot.counted;
  const strong = value != null && value >= 7;
  const weak = value != null && value < 6;

  const scoreTone = dropped
    ? "bg-white/8 text-faint"
    : strong
      ? "bg-acid text-ground"
      : weak
        ? "bg-flare/85 text-ground"
        : "bg-white/85 text-ground";

  return (
    <div
      className="pop flex min-w-0 flex-1 basis-0 flex-col items-center"
      style={{ animationDelay: `${0.03 * index}s`, maxWidth: 78 }}
      title={
        slot.swappedWith
          ? slot.status === "out"
            ? t("pitch.subOff", { name: slot.swappedWith })
            : t("pitch.subOn", { name: slot.swappedWith })
          : undefined
      }
    >
      <div className={`relative w-full ${dropped ? "opacity-45" : ""}`}>
        <Jersey
          teamId={slot.clubId}
          className="mx-auto block h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12"
        />
        {slot.status === "out" ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-[13px] w-[13px] place-items-center rounded-full bg-flare text-[8px] font-black leading-none text-ground sm:h-[15px] sm:w-[15px] sm:text-[9px]">
            ↓
          </span>
        ) : null}
        {slot.status === "in" ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-[13px] w-[13px] place-items-center rounded-full bg-acid text-[8px] font-black leading-none text-ground sm:h-[15px] sm:w-[15px] sm:text-[9px]">
            ↑
          </span>
        ) : null}
      </div>

      <div className="mt-0.5 w-full overflow-hidden rounded-[4px]">
        <div className="truncate bg-ground-3/90 px-1 py-[3px] text-center text-[8px] font-semibold leading-none text-ink sm:text-[9.5px] md:text-[10.5px]">
          {slot.name}
        </div>
        <div
          className={`num px-1 py-[3px] text-center text-[9px] font-extrabold leading-none sm:text-[11px] md:text-[12px] ${scoreTone}`}
        >
          {value != null ? formatPoints(value) : "–"}
        </div>
      </div>
    </div>
  );
}
