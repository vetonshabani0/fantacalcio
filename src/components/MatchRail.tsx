"use client";

import { motion } from "motion/react";
import { useFlash } from "@/hooks/useLive";
import type { RealMatch } from "@/lib/fanta/types";
import { Crest } from "./Crest";
import { intlLocale, useLocale } from "./LocaleProvider";
import { MatchState } from "./ui";

export function kickoffLabel(match: RealMatch, locale = "it-IT"): string {
  if (!match.kickoff) return "";
  // The feed publishes Italian wall-clock time with no zone marker.
  const date = new Date(`${match.kickoff}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function Side({
  teamId,
  name,
  goals,
  played,
  dim,
}: {
  teamId: number;
  name: string;
  goals: number;
  played: boolean;
  dim: boolean;
}) {
  const flash = useFlash(goals);
  return (
    <div className={`flex items-center justify-between gap-2 rounded px-1 ${flash}`}>
      <span className="flex min-w-0 items-center gap-2">
        <Crest teamId={teamId} teamName={name} size="sm" eager />
        <span
          className={`truncate text-[14px] font-medium ${dim ? "text-mute" : "text-ink"}`}
        >
          {name}
        </span>
      </span>
      <span
        className={`num text-[17px] font-extrabold ${
          played ? "text-ink" : "text-faint"
        }`}
      >
        {played ? goals : "–"}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  active,
  onSelect,
}: {
  match: RealMatch;
  active?: boolean;
  onSelect?: () => void;
}) {
  const { locale } = useLocale();
  const played = match.state !== "pre-match";
  const decided = match.state === "finished";
  const homeLost = decided && match.homeGoals < match.awayGoals;
  const awayLost = decided && match.awayGoals < match.homeGoals;

  const Element = onSelect ? motion.button : motion.div;

  return (
    <Element
      onClick={onSelect}
      whileTap={onSelect ? { scale: 0.97 } : undefined}
      className={`w-[188px] rounded-2xl border p-3.5 text-left transition-colors md:w-[210px] ${
        active
          ? "border-acid/55 bg-acid/[0.07]"
          : "border-[var(--line)] bg-ground-2 hover:border-[var(--edge)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <MatchState state={match.state} />
        <span className="label !text-[9px]">
          {kickoffLabel(match, intlLocale(locale))}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        <Side
          teamId={match.homeTeamId}
          name={match.homeTeamName}
          goals={match.homeGoals}
          played={played}
          dim={homeLost}
        />
        <Side
          teamId={match.awayTeamId}
          name={match.awayTeamName}
          goals={match.awayGoals}
          played={played}
          dim={awayLost}
        />
      </div>
    </Element>
  );
}

export function MatchRail({
  matches,
  activeId,
  onSelect,
}: {
  matches: RealMatch[];
  activeId?: number | null;
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="rail py-1">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          active={activeId === match.id}
          onSelect={onSelect ? () => onSelect(match.id) : undefined}
        />
      ))}
    </div>
  );
}

/** Endless horizontal score strip for the masthead. */
export function ScoreMarquee({ matches }: { matches: RealMatch[] }) {
  if (matches.length === 0) return null;
  const items = [...matches, ...matches];

  return (
    <div className="relative overflow-hidden border-y border-[var(--line)] py-2.5">
      <div className="marquee">
        {items.map((match, i) => {
          const played = match.state !== "pre-match";
          return (
            <span
              key={`${match.id}-${i}`}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap px-5 text-[12px]"
            >
              {match.state === "live" ? <span className="pip" /> : null}
              <Crest
                teamId={match.homeTeamId}
                teamName={match.homeTeamName}
                size="sm"
              />
              <span className="text-mute">{match.homeTeamName}</span>
              <span className="num font-bold text-ink">
                {played ? `${match.homeGoals}–${match.awayGoals}` : "vs"}
              </span>
              <Crest
                teamId={match.awayTeamId}
                teamName={match.awayTeamName}
                size="sm"
              />
              <span className="text-mute">{match.awayTeamName}</span>
              <span className="pl-3 text-faint">·</span>
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ground to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ground to-transparent" />
    </div>
  );
}
