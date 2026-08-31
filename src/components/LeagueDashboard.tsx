"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { LeagueView } from "@/lib/league-view";
import { HeadToHeadCard } from "./HeadToHead";
import { useT } from "./LocaleProvider";
import { LineupEditor } from "./LineupEditor";
import { StandingsTable } from "./StandingsTable";
import {
  CopyChip,
  Empty,
  formatTotal,
  Loading,
  LivePip,
  Reveal,
  Section,
  Segmented,
  Ticker,
} from "./ui";

type Tab = "sfida" | "classifica";

function MatchweekPicker({
  matchweek,
  total,
  onChange,
}: {
  matchweek: number;
  total: number;
  onChange: (mw: number) => void;
}) {
  const t = useT();
  const Step = ({ delta, label }: { delta: number; label: string }) => {
    const target = matchweek + delta;
    const disabled = target < 1 || target > total;
    return (
      <button
        onClick={() => onChange(target)}
        disabled={disabled}
        aria-label={label}
        className="tap grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-mute disabled:opacity-25"
      >
        {delta < 0 ? "‹" : "›"}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Step delta={-1} label={t("league.prevMatchweek")} />
      <span className="num min-w-[3.5rem] text-center text-[13px] font-bold">
        {t("league.matchweekShort", { n: matchweek })}
      </span>
      <Step delta={1} label={t("league.nextMatchweek")} />
    </div>
  );
}

/** The selected team's live standing, pinned above the fold on phones. */
function MyBanner({
  view,
  teamId,
  onOpenLineup,
}: {
  view: LeagueView;
  teamId: string;
  onOpenLineup: () => void;
}) {
  const t = useT();
  const row = view.standings.find((s) => s.teamId === teamId);
  const fixture = view.fixtures.find(
    (f) => f.home.teamId === teamId || f.away.teamId === teamId,
  );
  if (!row) return null;

  const me = fixture
    ? fixture.home.teamId === teamId
      ? fixture.home
      : fixture.away
    : null;
  const rival = fixture
    ? fixture.home.teamId === teamId
      ? fixture.away
      : fixture.home
    : null;
  const lead = me && rival ? me.total - rival.total : null;

  return (
    <div className="rounded-2xl border border-acid/35 bg-acid/[0.05] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label !text-acid">{t("league.myTeam")}</p>
          <h2 className="display-tight mt-1.5 truncate text-[24px] md:text-[28px]">
            {row.teamName}
          </h2>
        </div>
        <button onClick={onOpenLineup} className="tap label shrink-0 rounded-full border border-acid/40 px-3 py-1.5 !text-acid">
          {t("league.lineup")}
        </button>
      </div>

      <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
        <div>
          <p className="label">{t("league.position")}</p>
          <p className="num mt-1 text-[26px] font-extrabold">{row.position}º</p>
        </div>
        <div>
          <p className="label">{t("league.points")}</p>
          <p className="num mt-1 text-[26px] font-extrabold">{row.points}</p>
        </div>
        <div>
          <p className="label">{t("league.live")}</p>
          <p className="num mt-1 text-[26px] font-extrabold text-acid">
            {me ? (
              <Ticker value={me.total} decimals={me.total % 1 === 0 ? 0 : 1} />
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {rival && lead != null ? (
        <p className="mt-3 border-t border-acid/20 pt-3 text-[12px] text-mute">
          {t("league.against")}{" "}
          <span className="text-ink">{rival.teamName}</span> ·{" "}
          {lead > 0 ? (
            <span className="text-acid">
              {t("league.ahead", { n: formatTotal(Math.abs(lead)) })}
            </span>
          ) : lead < 0 ? (
            <span className="text-flare">
              {t("league.behind", { n: formatTotal(Math.abs(lead)) })}
            </span>
          ) : (
            <span>{t("league.level")}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}

export function LeagueDashboard({
  code,
  initialTeamId,
}: {
  code: string;
  initialTeamId: string | null;
}) {
  const { tick, connected } = useLiveVersion();
  const t = useT();
  const [matchweek, setMatchweek] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const [tab, setTab] = useState<Tab>(initialTeamId ? "sfida" : "classifica");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const url = useMemo(
    () =>
      matchweek == null
        ? `/api/league/${code}`
        : `/api/league/${code}?matchweek=${matchweek}`,
    [code, matchweek],
  );

  const { data, error, loading } = useLiveData<LeagueView>(
    url,
    (tick?.version ?? 0) + refreshNonce,
  );

  const myFixtureIndex = useMemo(() => {
    if (!data || !teamId) return -1;
    return data.fixtures.findIndex(
      (f) => f.home.teamId === teamId || f.away.teamId === teamId,
    );
  }, [data, teamId]);

  // The user's own fixture opens by default; the rest stay collapsed.
  useEffect(() => {
    if (myFixtureIndex >= 0) setExpanded(new Set([myFixtureIndex]));
  }, [myFixtureIndex, data?.matchweek]);

  if (error) return <Empty>{error}</Empty>;
  if (loading && !data) return <Loading label={t("league.loading")} />;
  if (!data) return null;

  const toggle = (index: number) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const ordered =
    myFixtureIndex >= 0
      ? [
          data.fixtures[myFixtureIndex],
          ...data.fixtures.filter((_, i) => i !== myFixtureIndex),
        ]
      : data.fixtures;

  const selectTeam = (id: string) => {
    setTeamId((current) => (current === id ? null : id));
    setTab("sfida");
  };

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <p className="label">{t("nav.leagues")}</p>
                <CopyChip text={data.league.code} />
              </div>
              <h1 className="display mt-3 text-[clamp(34px,9vw,72px)]">
                {data.league.name}
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
              {data.live ? <LivePip label="Live" /> : null}
              <span className="label !text-[9px]">
                {connected ? t("live.listening") : t("live.reconnecting")}
              </span>
            </div>
          </div>

          <p className="mt-4 text-[12px] text-faint">
            {t("league.meta", {
              teams: data.league.teamCount,
              mw: data.realMatchweek,
              first: data.league.firstGoalThreshold,
              step: data.league.goalStep,
            })}
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="w-[240px]">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "sfida", label: t("league.fixtures") },
                  { value: "classifica", label: t("league.table") },
                ]}
              />
            </div>
            <MatchweekPicker
              matchweek={data.matchweek}
              total={data.totalMatchweeks}
              onChange={setMatchweek}
            />
          </div>
        </Reveal>

        {teamId ? (
          <Reveal delay={0.1}>
            <div className="mt-6">
              <MyBanner
                view={data}
                teamId={teamId}
                onOpenLineup={() => setEditing(true)}
              />
            </div>
          </Reveal>
        ) : null}
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "classifica" ? (
            <section className="pt-10">
              <Section
                title={t("league.table")}
                hint={
                  data.matchesSettled
                    ? t("league.settled")
                    : t("league.liveHint")
                }
              />
              <div className="gutter mt-5">
                <StandingsTable
                  standings={data.standings}
                  highlightTeamId={teamId}
                  onSelect={selectTeam}
                  showLive={!data.matchesSettled}
                />
              </div>
            </section>
          ) : (
            <section className="pt-10">
              <Section
                title={t("live.matchweek", { n: data.matchweek })}
                hint={t("league.fixtureCount", { n: data.fixtures.length })}
              />
              <div className="gutter mt-5 flex flex-col gap-4">
                {ordered.length === 0 ? (
                  <Empty>{t("league.noFixtures")}</Empty>
                ) : (
                  ordered.map((fixture) => {
                    const index = data.fixtures.indexOf(fixture);
                    const mine =
                      !!teamId &&
                      (fixture.home.teamId === teamId ||
                        fixture.away.teamId === teamId);
                    return (
                      <HeadToHeadCard
                        key={`${fixture.home.teamId}-${fixture.away.teamId}`}
                        fixture={fixture}
                        firstThreshold={data.league.firstGoalThreshold}
                        step={data.league.goalStep}
                        expanded={expanded.has(index)}
                        onToggle={() => toggle(index)}
                        featured={mine}
                      />
                    );
                  })
                )}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {editing && teamId ? (
        <LineupEditor
          code={code}
          teamId={teamId}
          matchweek={data.matchweek}
          onClose={() => setEditing(false)}
          onSaved={() => setRefreshNonce((n) => n + 1)}
        />
      ) : null}
    </>
  );
}
