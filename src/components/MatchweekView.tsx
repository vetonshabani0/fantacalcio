"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { MatchweekView as View } from "@/lib/fanta/public-league";
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
  N: "bg-white/12 text-mute",
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
                  ? "border-[var(--line)] text-ink hover:border-white/30"
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
        <Section title={t("mw.results")} hint={t("mw.noFixtures")} />
        <div className="gutter mt-5">
          {!view.settled ? (
            <Empty>{t("mw.notPlayed")}</Empty>
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
