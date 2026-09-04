"use client";

import { useCallback, useRef, useState } from "react";
import type { BoardPlayer, LiveBoard } from "@/lib/api-types";
import type { EstimatedTeam, LiveEstimate } from "@/lib/fanta/public-live";
import { Crest } from "./Crest";
import { useT } from "./LocaleProvider";
import { PlayerSheet } from "./PlayerSheet";
import { TeamBadge } from "./TeamBadge";
import {
  formatPoints,
  LivePip,
  Role,
  Section,
  Ticker,
} from "./ui";

/**
 * The eleven behind one estimated score.
 *
 * Kept collapsed by default: the score is the point, and a league of ten teams
 * would otherwise open as two hundred player rows.
 */
function Lineup({
  team,
  onSelect,
}: {
  team: EstimatedTeam;
  onSelect: (playerId: number) => void;
}) {
  const t = useT();

  return (
    <div className="grid grid-cols-1 gap-x-8 pb-2 sm:grid-cols-2">
      {team.players.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className="tap flex w-full items-center gap-2.5 border-b border-[var(--line-soft)] py-2 text-left"
        >
          <Role role={p.role} />
          <Crest teamId={p.clubId} teamName={p.club} size="sm" eager />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {p.name}
            </span>
            <span className="block truncate text-[10.5px] text-faint">
              {p.cameOnFor ? t("est.cameOnFor", { name: p.cameOnFor }) : p.club}
            </span>
          </span>
          <span
            className={`num shrink-0 text-[14px] font-extrabold ${
              p.void || !p.hasVote
                ? "text-faint"
                : p.bonus > 0
                  ? "text-acid"
                  : p.bonus < 0
                    ? "text-flare"
                    : "text-ink"
            }`}
          >
            {p.void
              ? t("est.forVoid")
              : p.fantavoto != null
                ? formatPoints(p.fantavoto)
                : "—"}
          </span>
        </button>
      ))}
    </div>
  );
}

function TeamRow({
  team,
  index,
  onSelect,
}: {
  team: EstimatedTeam;
  index: number;
  onSelect: (playerId: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ animationDelay: `${index * 0.04}s` }}
      className="reveal border-b border-[var(--line-soft)]"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
          {index + 1}
        </span>
        <TeamBadge logo={team.logo} name={team.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {team.name}
          </span>
          <span className="block truncate text-[10.5px] text-faint">
            {team.formation} · {t("est.rated", { n: team.ratedSlots })}
            {team.substitutionsUsed
              ? ` · ${t("est.subs", { n: team.substitutionsUsed })}`
              : ""}
            {team.defenseModifier
              ? ` · ${t("est.modifier", {
                  n:
                    team.defenseModifier > 0
                      ? `+${team.defenseModifier}`
                      : team.defenseModifier,
                })}`
              : ""}
          </span>
        </span>
        <span className="num w-16 shrink-0 text-right text-[17px] font-extrabold">
          <Ticker
            value={team.fantapoints}
            decimals={team.fantapoints % 1 === 0 ? 0 : 1}
          />
        </span>
        <span className="num w-8 shrink-0 text-right text-[19px] font-extrabold text-acid">
          {team.goals}
        </span>
        <span
          className={`shrink-0 text-[13px] text-faint transition-transform ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {/* The same 0fr → 1fr collapse the head-to-head uses: pure CSS, and it
          lands open even if no animation frame ever arrives. */}
      <div
        className="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {open ? <Lineup team={team} onSelect={onSelect} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Live scores for a matchweek the league has not calculated yet.
 *
 * Everything here is reconstructed rather than reported, so the panel says so
 * twice — once as a badge next to the heading, once as the note underneath —
 * and never borrows the styling of the settled results above it.
 */
export function LiveEstimateBoard({ estimate }: { estimate: LiveEstimate }) {
  const t = useT();
  const [selected, setSelected] = useState<BoardPlayer | null>(null);
  // The full board is a large payload and only a tap needs it, so it is fetched
  // once on the first one and kept, rather than polled alongside the estimate.
  const board = useRef<Record<number, BoardPlayer> | null>(null);

  const openPlayer = useCallback(
    async (playerId: number) => {
      if (!board.current) {
        // Explicitly the round being estimated: a league can sit a matchweek
        // behind Serie A, and the default board would then explain the wrong one.
        const data = (await fetch(
          `/api/live?matchweek=${estimate.serieAMatchweek}`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)) as LiveBoard | null;
        if (!data?.players) return;
        board.current = Object.fromEntries(data.players.map((p) => [p.id, p]));
      }
      const player = board.current[playerId];
      if (player) setSelected(player);
    },
    [estimate.serieAMatchweek],
  );

  return (
    <section className="pt-12">
      <Section
        title={t("est.title")}
        hint={t("est.hint")}
        right={
          <span className="flex items-center gap-2.5">
            {estimate.live ? <LivePip label={t("est.live")} /> : null}
            <span className="label rounded-full border border-gold/40 px-2.5 py-1 !text-gold">
              {t("est.badge")}
            </span>
          </span>
        }
      />

      <div className="gutter mt-5">
        {estimate.complete && !estimate.live ? (
          <p className="mb-4 text-[11.5px] text-gold">{t("est.complete")}</p>
        ) : null}

        <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
          <span className="label w-5 text-right">#</span>
          <span className="w-7" />
          <span className="label flex-1">{t("mw.team")}</span>
          <span className="label w-16 text-right">{t("mw.fantapoints")}</span>
          <span className="label w-8 text-right">{t("mw.goals")}</span>
          <span className="w-3" />
        </div>

        {estimate.teams.map((team, i) => (
          <TeamRow
            key={team.teamId}
            team={team}
            index={i}
            onSelect={openPlayer}
          />
        ))}

        {estimate.missing.length ? (
          <p className="pt-3 text-[11px] text-faint">
            {t("est.missing", { n: estimate.missing.length })}
          </p>
        ) : null}

        <p className="pt-4 text-[11.5px] leading-relaxed text-faint">
          {t("est.how")}
        </p>
      </div>

      <PlayerSheet player={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
