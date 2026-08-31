"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useFlash } from "@/hooks/useLive";
import type {
  SerializedHeadToHead,
  SerializedSide,
  SerializedSlot,
} from "@/lib/league-view";
import { useT } from "./LocaleProvider";
import { Pitch } from "./Pitch";
import { formatPoints, formatTotal, Role, Segmented, Ticker } from "./ui";

/** Progress from the last fantasy goal towards the next one. */
function goalProgress(total: number, first: number, step: number): number {
  if (total < first) return Math.max(0, Math.min(1, total / first));
  return ((total - first) % step) / step;
}

function SlotLine({ slot }: { slot: SerializedSlot }) {
  const t = useT();
  const flash = useFlash(slot.fantavoto);

  return (
    <div
      className={`flex items-start gap-3 border-b border-[var(--line-soft)] py-2.5 ${flash} ${
        slot.void ? "opacity-50" : ""
      }`}
    >
      <Role role={slot.role} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-medium">{slot.name}</span>
          <span className="shrink-0 text-[10px] text-faint">
            {slot.teamName}
          </span>
        </div>

        {slot.substitution ? (
          <div className="mt-1 text-[10.5px] leading-tight">
            <span className="text-flare/75">↓ {slot.substitution.outName}</span>
            <span className="text-faint">
              {" "}
              {t(slot.substitution.outReason as "h2h.reasonNoVote")}
            </span>
            <span className="text-acid"> ↑ {slot.substitution.inName}</span>
          </div>
        ) : null}

        {slot.void ? (
          <div className="mt-1 text-[10.5px] text-gold/85">
            {t("h2h.noSubstitute")}
          </div>
        ) : null}

        {slot.breakdown.length ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]">
            {slot.breakdown.map((item) => (
              <span
                key={item.label}
                className={item.points >= 0 ? "text-acid/85" : "text-flare/85"}
              >
                {item.label}
                {item.count > 1 ? ` ×${item.count}` : ""}{" "}
                {item.points > 0 ? "+" : ""}
                {formatPoints(item.points)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <span className="num shrink-0 text-[11px] text-faint">
        {slot.grade != null ? formatPoints(slot.grade) : "sv"}
      </span>
      <span
        className={`num w-11 shrink-0 text-right text-[16px] font-extrabold ${
          slot.void ? "text-faint" : "text-ink"
        }`}
      >
        {slot.void || slot.fantavoto == null ? "—" : formatPoints(slot.fantavoto)}
      </span>
    </div>
  );
}

function SideDetail({ side }: { side: SerializedSide }) {
  const t = useT();
  return (
    <div>
      <Pitch side={side} />

      <div className="mt-5">
        {side.slots.map((slot, i) => (
          <SlotLine key={`${slot.playerId}-${i}`} slot={slot} />
        ))}
      </div>

      <dl className="mt-4 space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-faint">{t("h2h.sumOfScores")}</dt>
          <dd className="num text-mute">{formatTotal(side.baseTotal)}</dd>
        </div>
        {side.defenseAverage != null ? (
          <div className="flex justify-between">
            <dt className="text-faint">
              {t("h2h.defenceModifier", {
                n: side.defenseAverage.toFixed(2),
              })}
            </dt>
            <dd
              className={`num ${side.defenseModifier > 0 ? "text-acid" : "text-mute"}`}
            >
              {side.defenseModifier > 0 ? "+" : ""}
              {side.defenseModifier}
            </dd>
          </div>
        ) : null}
        {side.bench.length ? (
          <div className="pt-1.5 text-faint">
            {t("h2h.bench")}: {side.bench.map((b) => b.name).join(", ")}
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function Half({
  side,
  goals,
  align,
  first,
  step,
}: {
  side: SerializedSide;
  goals: number;
  align: "left" | "right";
  first: number;
  step: number;
}) {
  const t = useT();
  const flash = useFlash(side.total);
  const right = align === "right";

  return (
    <div className={`min-w-0 ${right ? "text-right" : ""}`}>
      <p className="truncate text-[12px] font-medium text-mute">
        {side.teamName}
      </p>
      <div className={`num mt-1 rounded text-[34px] font-extrabold leading-none md:text-[44px] ${flash}`}>
        <Ticker value={side.total} decimals={side.total % 1 === 0 ? 0 : 1} />
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ scaleX: goalProgress(side.total, first, step) }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: right ? 1 : 0 }}
          className="h-full rounded-full bg-acid"
        />
      </div>
      <p className="mt-1.5 text-[10.5px] text-faint">
        {side.pointsToNextGoal > 0
          ? t("h2h.toNextGoal", { n: formatTotal(side.pointsToNextGoal) })
          : t("h2h.goalReached")}
        {" · "}
        {side.ratedSlots}/11
      </p>
    </div>
  );
}

export function HeadToHeadCard({
  fixture,
  firstThreshold,
  step,
  expanded,
  onToggle,
  featured = false,
}: {
  fixture: SerializedHeadToHead;
  firstThreshold: number;
  step: number;
  expanded: boolean;
  onToggle: () => void;
  featured?: boolean;
}) {
  const t = useT();
  const [side, setSide] = useState<"home" | "away">("home");

  return (
    <div
      className={`rounded-2xl border bg-ground-2 ${
        featured ? "border-acid/40" : "border-[var(--line)]"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 p-4 md:gap-6 md:p-5">
        <Half
          side={fixture.home}
          goals={fixture.homeGoals}
          align="left"
          first={firstThreshold}
          step={step}
        />

        <div className="shrink-0 pt-4 text-center">
          <div className="num text-[26px] font-extrabold leading-none md:text-[32px]">
            {fixture.homeGoals}
            <span className="px-1.5 text-faint">–</span>
            {fixture.awayGoals}
          </div>
          <p className="label mt-1.5 !text-[9px]">
            {fixture.settled ? t("h2h.final") : t("h2h.inProgress")}
          </p>
        </div>

        <Half
          side={fixture.away}
          goals={fixture.awayGoals}
          align="right"
          first={firstThreshold}
          step={step}
        />
      </div>

      <button
        onClick={onToggle}
        className="tap label w-full border-t border-[var(--line)] py-3 transition-colors hover:!text-ink"
      >
        {expanded ? t("h2h.hideLineups") : t("h2h.showLineups")}
      </button>

      {/*
        A grid whose single row animates between 0fr and 1fr collapses smoothly
        in pure CSS. Unlike an animated height, it reaches its open state even
        if no animation frame ever arrives.
      */}
      <div
        className="grid transition-[grid-template-rows] duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {expanded ? (
            <div className="border-t border-[var(--line)] p-4 md:p-5">
              <div className="mx-auto max-w-sm md:hidden">
                <Segmented
                  value={side}
                  onChange={setSide}
                  options={[
                    { value: "home", label: fixture.home.teamName },
                    { value: "away", label: fixture.away.teamName },
                  ]}
                />
              </div>

              <div className="mt-5 md:hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={side}
                    initial={{ opacity: 0, x: side === "home" ? -14 : 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: side === "home" ? 14 : -14 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SideDetail
                      side={side === "home" ? fixture.home : fixture.away}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="hidden gap-10 md:grid md:grid-cols-2">
                <SideDetail side={fixture.home} />
                <SideDetail side={fixture.away} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
