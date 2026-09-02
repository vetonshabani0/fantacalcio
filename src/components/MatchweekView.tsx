"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { ImportedFixture } from "@/lib/fanta/calendar-import";
import { loadCalendar } from "@/lib/calendar-storage";
import type { MatchweekEntry, MatchweekView as View } from "@/lib/fanta/public-league";
import { CalendarImport } from "./CalendarImport";
import { useT } from "./LocaleProvider";
import { TeamBadge } from "./TeamBadge";
import { Empty, formatTotal, Loading, Reveal, Section } from "./ui";

interface Payload {
  league: { alias: string; competitionName: string };
  view: View;
  error?: string;
}

const RESULT_TONE: Record<string, string> = {
  V: "bg-acid text-ground",
  N: "bg-fill-strong text-mute",
  P: "bg-flare/25 text-flare",
};

/** Horizontal strip of every matchweek, current one centred. */
function MatchweekRail({
  alias,
  current,
  last,
  lastSettled,
}: {
  alias: string;
  current: number;
  last: number;
  lastSettled: number;
}) {
  return (
    <div className="rail py-1">
      {Array.from({ length: last }, (_, i) => i + 1).map((n) => {
        const active = n === current;
        const played = n <= lastSettled;
        return (
          <Link
            key={n}
            href={`/lega-pubblica/${alias}/giornata/${n}`}
            scroll={false}
            className={`num tap grid h-9 w-9 place-items-center rounded-full border text-[13px] font-bold transition-colors ${
              active
                ? "border-acid bg-acid text-ground"
                : played
                  ? "border-[var(--line)] text-ink hover:border-[var(--edge-strong)]"
                  : "border-[var(--line)] text-faint"
            }`}
          >
            {n}
          </Link>
        );
      })}
    </div>
  );
}

/** Real matchups, once a calendar has been imported. */
function Fixtures({
  fixtures,
  entries,
  alias,
}: {
  fixtures: ImportedFixture[];
  entries: MatchweekEntry[];
  alias: string;
}) {
  const t = useT();
  const tLabel = t("pitch.open");
  const byId = new Map(entries.map((e) => [e.teamId, e]));

  return (
    <div className="flex flex-col gap-3">
      {fixtures.map((f, i) => {
        const home = byId.get(f.homeTeamId);
        const away = byId.get(f.awayTeamId);
        if (!home || !away) return null;

        // Prefer the league's own recorded result over anything derived here.
        const hg = f.homeGoals ?? home.goals;
        const ag = f.awayGoals ?? away.goals;
        const hp = f.homeFantapoints ?? home.fantapoints;
        const ap = f.awayFantapoints ?? away.fantapoints;
        const homeWon = hg > ag;
        const awayWon = ag > hg;

        return (
          <Link
            key={`${f.homeTeamId}-${f.awayTeamId}`}
            href={`/lega-pubblica/${alias}/giornata/${f.matchweek}/${f.homeTeamId}/${f.awayTeamId}`}
            style={{ animationDelay: `${i * 0.05}s` }}
            className="tap reveal grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-[var(--line)] bg-ground-2 p-3.5 transition-colors hover:border-[var(--edge)] md:gap-4 md:p-4"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <TeamBadge logo={home.logo} name={home.name} size="sm" />
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-semibold leading-tight md:text-[14px] ${homeWon ? "" : "text-mute"}`}
                >
                  {home.name}
                </span>
                <span className="num block text-[11px] text-faint">
                  {formatTotal(hp)}
                </span>
              </span>
            </span>

            <span className="shrink-0 text-center">
              <span className="num block text-[20px] font-extrabold md:text-[24px]">
                {hg}
                <span className="px-1.5 text-faint">–</span>
                {ag}
              </span>
              <span className="label !text-[8.5px] !text-acid">{tLabel}</span>
            </span>

            <span className="flex min-w-0 flex-row-reverse items-center gap-2.5">
              <TeamBadge logo={away.logo} name={away.name} size="sm" />
              <span className="min-w-0 text-right">
                <span
                  className={`block text-[13px] font-semibold leading-tight md:text-[14px] ${awayWon ? "" : "text-mute"}`}
                >
                  {away.name}
                </span>
                <span className="num block text-[11px] text-faint">
                  {formatTotal(ap)}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function MatchweekView({
  alias,
  matchweek,
}: {
  alias: string;
  matchweek: string;
}) {
  const t = useT();
  const router = useRouter();
  const { tick } = useLiveVersion();
  const { data, error, loading } = useLiveData<Payload>(
    `/api/public/${alias}/matchweek/${matchweek}`,
    tick?.version,
  );
  const [calendar, setCalendar] = useState<ImportedFixture[] | null>(null);

  useEffect(() => setCalendar(loadCalendar(alias)), [alias]);

  if (error || data?.error) {
    return (
      <section className="gutter pt-16">
        <h1 className="display text-[clamp(30px,9vw,64px)]">
          {t("pub.notFound")}
        </h1>
        <Link
          href={`/lega-pubblica/${alias}`}
          className="tap mt-7 inline-block rounded-full bg-acid px-5 py-2.5 text-[14px] font-bold text-ground"
        >
          {t("team.back")}
        </Link>
      </section>
    );
  }

  if (loading && !data) return <Loading label={t("mw.loading")} />;
  if (!data) return null;

  const { view } = data;
  const go = (n: number) =>
    router.push(`/lega-pubblica/${alias}/giornata/${n}`, { scroll: false });

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <Link
            href={`/lega-pubblica/${alias}`}
            className="link-underline text-[13px] text-mute"
          >
            ← {data.league.competitionName}
          </Link>

          <div className="mt-5 flex items-center justify-between gap-4">
            <h1 className="display text-[clamp(30px,8.5vw,68px)]">
              {t("mw.title", { n: view.matchweek })}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => go(view.matchweek - 1)}
                disabled={view.matchweek <= 1}
                aria-label={t("mw.prev")}
                className="tap grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-mute disabled:opacity-25"
              >
                ‹
              </button>
              <button
                onClick={() => go(view.matchweek + 1)}
                disabled={view.matchweek >= view.lastMatchweek}
                aria-label={t("mw.next")}
                className="tap grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-mute disabled:opacity-25"
              >
                ›
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal delay={0.05}>
        <div className="pt-5">
          <MatchweekRail
            alias={alias}
            current={view.matchweek}
            last={view.lastMatchweek}
            lastSettled={view.lastSettled}
          />
        </div>
      </Reveal>

      <section className="pt-12">
        <Section
          title={t("mw.results")}
          hint={calendar ? undefined : t("mw.noFixtures")}
        />
        <div className="gutter mt-5">
          {!view.settled ? (
            <Empty>{t("mw.notPlayed")}</Empty>
          ) : calendar ? (
            <Fixtures
              fixtures={calendar.filter((f) => f.matchweek === view.matchweek)}
              entries={view.entries}
              alias={alias}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
                <span className="w-7" />
                <span className="label flex-1">{t("mw.team")}</span>
                <span className="label w-16 text-right">
                  {t("mw.fantapoints")}
                </span>
                <span className="label w-10 text-right">{t("mw.goals")}</span>
                <span className="label w-9 text-right">{t("mw.points")}</span>
              </div>

              {view.entries.map((e, i) => (
                <Link
                  key={e.teamId}
                  href={`/lega-pubblica/${alias}/squadra/${e.teamId}`}
                  style={{ animationDelay: `${i * 0.035}s` }}
                  className="tap reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3"
                >
                  <TeamBadge logo={e.logo} name={e.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">
                        {e.name}
                      </span>
                      <span
                        className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded px-1 text-[9.5px] font-black ${RESULT_TONE[e.result]}`}
                      >
                        {e.result}
                      </span>
                    </span>
                  </span>
                  <span className="num w-16 text-right text-[17px] font-extrabold">
                    {formatTotal(e.fantapoints)}
                  </span>
                  <span className="num w-10 text-right text-[15px] text-mute">
                    {e.goals}
                  </span>
                  <span className="num w-9 text-right text-[17px] font-extrabold text-acid">
                    {e.points}
                  </span>
                </Link>
              ))}

              <p className="pt-3 text-[11px] leading-relaxed text-faint">
                {t("mw.goalsNote")}
              </p>
            </>
          )}
        </div>

        <div className="gutter mt-6">
          <CalendarImport
            alias={alias}
            hasCalendar={!!calendar}
            onChange={setCalendar}
          />
        </div>
      </section>

      {view.settled ? (
        <section className="pt-14">
          <Section title={t("mw.tableAfter", { n: view.matchweek })} />
          <div className="gutter mt-5">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
              <span className="label w-5 text-right">#</span>
              <span className="w-7" />
              <span className="label flex-1">{t("mw.team")}</span>
              <span className="label hidden w-16 text-center sm:block">
                {t("pub.record")}
              </span>
              <span className="label w-16 text-right">
                {t("mw.fantapoints")}
              </span>
              <span className="label w-9 text-right">{t("mw.points")}</span>
            </div>

            {view.tableAfter.map((row, i) => (
              <Link
                key={row.teamId}
                href={`/lega-pubblica/${alias}/squadra/${row.teamId}`}
                style={{ animationDelay: `${i * 0.035}s` }}
                className="tap reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3"
              >
                <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
                  {row.position}
                </span>
                <TeamBadge logo={row.logo} name={row.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {row.name}
                </span>
                <span className="num hidden w-16 shrink-0 text-center text-[12px] text-mute sm:block">
                  {row.won}-{row.drawn}-{row.lost}
                </span>
                <span className="num w-16 shrink-0 text-right text-[13px] text-mute">
                  {formatTotal(row.fantapoints)}
                </span>
                <span className="num w-9 shrink-0 text-right text-[19px] font-extrabold">
                  {row.points}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
