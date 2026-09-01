"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useLiveBoard } from "@/hooks/useLive";
import { formatFormation, minuteLabel, minuteOrder } from "@/lib/fanta/format";
import type { BoardPlayer } from "@/lib/api-types";
import { intlLocale, useLocale, useT } from "./LocaleProvider";
import { Crest } from "./Crest";
import { MatchDetail } from "./MatchDetail";
import { MatchRail } from "./MatchRail";
import { PlayerSheet } from "./PlayerSheet";
import {
  Empty,
  formatPoints,
  Loading,
  LivePip,
  Reveal,
  Role,
  Section,
} from "./ui";

function clockLabel(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}

function Movers({
  players,
  onSelect,
}: {
  players: BoardPlayer[];
  onSelect: (player: BoardPlayer) => void;
}) {
  const t = useT();
  const rated = players.filter((p) => p.hasVote && p.fantavoto != null);
  const best = [...rated]
    .sort((a, b) => (b.fantavoto ?? 0) - (a.fantavoto ?? 0))
    .slice(0, 5);
  const worst = [...rated]
    .sort((a, b) => (a.fantavoto ?? 0) - (b.fantavoto ?? 0))
    .slice(0, 5);

  const List = ({
    title,
    rows,
    tone,
  }: {
    title: string;
    rows: BoardPlayer[];
    tone: string;
  }) => (
    <div>
      <p className="label border-b border-[var(--line)] pb-1.5">{title}</p>
      {rows.length === 0 ? (
        <p className="py-6 text-[13px] text-faint">{t("live.noVotesYet")}</p>
      ) : (
        rows.map((player, i) => (
          <button
            key={player.id}
            onClick={() => onSelect(player)}
            className="flex w-full items-center gap-3 border-b border-[var(--line-soft)] py-2.5 text-left"
          >
            <span className="num w-3 text-[10px] text-faint">{i + 1}</span>
            <Role role={player.role} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
              {player.name}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
              <Crest
                teamId={player.teamId}
                teamName={player.teamName}
                size="sm"
              />
              {player.teamName}
            </span>
            <span className={`num w-11 shrink-0 text-right text-[17px] font-extrabold ${tone}`}>
              {formatPoints(player.fantavoto ?? 0)}
            </span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="gutter grid gap-10 md:grid-cols-2 md:gap-12">
      <List title={t("live.best")} rows={best} tone="text-acid" />
      <List title={t("live.worst")} rows={worst} tone="text-flare" />
    </div>
  );
}

function Changes({ players }: { players: BoardPlayer[] }) {
  const t = useT();
  const byId = new Map(players.map((p) => [p.id, p]));
  const subs = players
    .filter((p) => p.replacedPlayerId)
    .map((incoming) => ({
      incoming,
      outgoing: byId.get(incoming.replacedPlayerId!) ?? null,
      minute: incoming.events.find((e) => e.kind === "subbedIn")?.minute ?? 0,
    }))
    .sort((a, b) => minuteOrder(b.minute) - minuteOrder(a.minute));

  if (subs.length === 0) return <Empty>{t("live.noChanges")}</Empty>;

  return (
    <div className="gutter">
      <div className="max-h-[24rem] overflow-y-auto overscroll-contain no-scrollbar">
        {subs.map(({ incoming, outgoing, minute }) => (
          <div
            key={incoming.id}
            className="flex items-center gap-3 border-b border-[var(--line-soft)] py-2.5"
          >
            <span className="num w-11 shrink-0 text-[12px] font-bold text-faint">
              {minuteLabel(minute)}
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="block truncate">
                <span className="text-acid">↑</span>{" "}
                <span className="font-medium">{incoming.name}</span>
              </span>
              {outgoing ? (
                <span className="block truncate text-mute">
                  <span className="text-flare/70">↓</span> {outgoing.name}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
              <Crest
                teamId={incoming.teamId}
                teamName={incoming.teamName}
                size="sm"
              />
              {incoming.teamName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveBoardView() {
  const { data, error, loading, connected } = useLiveBoard();
  const { t, locale } = useLocale();
  const [selected, setSelected] = useState<number | null>(null);
  const [player, setPlayer] = useState<BoardPlayer | null>(null);

  const activeMatch = useMemo(() => {
    if (!data) return null;
    if (selected != null) {
      return data.matches.find((m) => m.id === selected) ?? null;
    }

    // Open on whatever has something to show: a match in play, otherwise the
    // one that finished most recently, and only then an upcoming fixture.
    const live = data.matches.find((m) => m.state === "live");
    if (live) return live;

    const kickoff = (match: (typeof data.matches)[number]) =>
      match.kickoff ? Date.parse(`${match.kickoff}Z`) : 0;

    const finished = data.matches
      .filter((m) => m.state === "finished")
      .sort((a, b) => kickoff(b) - kickoff(a));
    if (finished.length) return finished[0];

    return [...data.matches].sort((a, b) => kickoff(a) - kickoff(b))[0] ?? null;
  }, [data, selected]);

  if (error) return <Empty>{t("live.loadError", { msg: error })}</Empty>;
  if (loading && !data) return <Loading label={t("live.loading")} />;
  if (!data) return null;

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label">{t("live.season", { n: data.pointer.seasonId })}</p>
              <h1 className="display mt-3 text-[clamp(26px,7.5vw,76px)]">
                {t("live.matchweek", { n: data.pointer.matchweek })}
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
              {data.live ? <LivePip label="Live" /> : null}
              <span className="label !text-[9px]">
                {connected ? t("live.listening") : t("live.reconnecting")}
              </span>
              <span className="num text-[11px] text-faint">
                {clockLabel(data.fetchedAt, intlLocale(locale))}
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal delay={0.06}>
        <div className="pt-8">
          <MatchRail
            matches={data.matches}
            activeId={activeMatch?.id ?? null}
            onSelect={setSelected}
          />
        </div>
      </Reveal>

      {activeMatch ? (
        <section className="pt-12">
          <Section
            titleNode={
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Crest
                  teamId={activeMatch.homeTeamId}
                  teamName={activeMatch.homeTeamName}
                  size="lg"
                />
                <span>{activeMatch.homeTeamName}</span>
                <span className="text-faint">—</span>
                <Crest
                  teamId={activeMatch.awayTeamId}
                  teamName={activeMatch.awayTeamName}
                  size="lg"
                />
                <span>{activeMatch.awayTeamName}</span>
              </span>
            }
            title={`${activeMatch.homeTeamName} — ${activeMatch.awayTeamName}`}
            hint={
              activeMatch.homeFormation
                ? t("live.lineupsVs", {
                    a: formatFormation(activeMatch.homeFormation),
                    b: formatFormation(activeMatch.awayFormation),
                  })
                : t("live.lineupsPending")
            }
            right={
              activeMatch.state !== "pre-match" ? (
                <span className="num text-[30px] font-extrabold">
                  {activeMatch.homeGoals}–{activeMatch.awayGoals}
                </span>
              ) : null
            }
          />
          <div className="mt-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeMatch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <MatchDetail
                  match={activeMatch}
                  players={data.players}
                  onSelectPlayer={setPlayer}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      <section className="pt-16">
        <Section title={t("live.movers")} hint={t("live.moversHint")} />
        <div className="mt-5">
          <Movers players={data.players} onSelect={setPlayer} />
        </div>
      </section>

      <section className="pt-16">
        <Section
          title={t("live.changes")}
          hint={t("live.changesHint", {
            n: data.players.filter((p) => p.replacedPlayerId).length,
          })}
        />
        <div className="mt-5">
          <Changes players={data.players} />
        </div>
      </section>

      <PlayerSheet player={player} onClose={() => setPlayer(null)} />
    </>
  );
}
