"use client";

import Link from "next/link";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { PublicLeague } from "@/lib/fanta/public-league";
import type { LiveEstimate } from "@/lib/fanta/public-live";
import { LiveEstimateStrip } from "./LiveEstimate";
import { useT } from "./LocaleProvider";
import { TeamBadge } from "./TeamBadge";
import { Empty, formatTotal, Loading, LivePip, Reveal, Section } from "./ui";

interface Payload {
  league: PublicLeague;
  serieA: { matchweek: number; live: boolean } | null;
  /** The current matchweek, rebuilt from the squads. Null before kickoff. */
  estimate: LiveEstimate | null;
  error?: string;
}

export function PublicLeagueView({ alias }: { alias: string }) {
  const t = useT();
  const { tick } = useLiveVersion();
  const { data, error, loading } = useLiveData<Payload>(
    `/api/public/${alias}`,
    tick?.version,
  );

  if (error || data?.error) {
    return (
      <section className="gutter pt-16">
        <p className="label">404</p>
        <h1 className="display mt-3 text-[clamp(34px,10vw,72px)]">
          {t("pub.notFound")}
        </h1>
        <p className="mt-4 max-w-[42ch] text-[15px] text-mute">
          {t("pub.notFoundBody")}
        </p>
        <Link
          href="/"
          className="tap mt-7 inline-block rounded-full bg-acid px-5 py-2.5 text-[14px] font-bold text-ground"
        >
          {t("pub.back")}
        </Link>
      </section>
    );
  }

  if (loading && !data) return <Loading label={t("pub.loading")} />;
  if (!data) return null;

  const { league, serieA } = data;

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label">{league.alias}</p>
              <h1 className="display mt-3 text-[clamp(28px,7.5vw,68px)]">
                {league.competitionName}
              </h1>
            </div>
            {serieA?.live ? (
              <div className="shrink-0 pt-1">
                <LivePip label="Live" />
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-[12px] text-faint">
            {t("pub.teams", { n: league.teams.length })}
            {league.president
              ? ` · ${t("pub.president", { name: league.president })}`
              : ""}
            {serieA ? ` · ${t("real.serieA", { n: serieA.matchweek })}` : ""}
          </p>
          <p className="mt-1.5 text-[11px] text-acid">{t("pub.noLogin")}</p>
        </Reveal>

        {data.estimate ? (
          <Reveal delay={0.08}>
            <div className="mt-7">
              <LiveEstimateStrip
                estimate={data.estimate}
                href={`/lega-pubblica/${league.alias}/giornata/${data.estimate.matchweek}`}
              />
            </div>
          </Reveal>
        ) : null}
      </section>

      <section className="pt-10">
        <Section
          title={t("pub.standings")}
          right={
            <Link
              href={`/lega-pubblica/${league.alias}/giornata/${league.currentMatchweek}`}
              className="tap label rounded-full border border-acid/40 px-3 py-1.5 !text-acid"
            >
              {t("mw.open")}
            </Link>
          }
        />
        <div className="gutter mt-5">
          {league.teams.length === 0 ? (
            <Empty>{t("pub.notFoundBody")}</Empty>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
                <span className="label w-5 text-right">#</span>
                <span className="w-7" />
                <span className="label flex-1">{t("pub.team")}</span>
                <span className="label hidden w-16 text-center sm:block">
                  {t("pub.record")}
                </span>
                <span className="label hidden w-14 text-center sm:block">
                  {t("pub.goals")}
                </span>
                <span className="label w-16 text-right">
                  {t("pub.fantapoints")}
                </span>
                <span className="label w-8 text-right">{t("pub.points")}</span>
              </div>

              {league.teams.map((team, i) => (
                <Link
                  key={team.id}
                  href={`/lega-pubblica/${league.alias}/squadra/${team.id}`}
                  style={{ animationDelay: `${i * 0.035}s` }}
                  className="tap reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
                    {team.position}
                  </span>
                  <TeamBadge logo={team.logo} name={team.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {team.name}
                    </span>
                    <span className="block truncate text-[11px] text-faint sm:hidden">
                      {team.won}-{team.drawn}-{team.lost} · {team.goalsFor}:
                      {team.goalsAgainst}
                    </span>
                  </span>
                  <span className="num hidden w-16 shrink-0 text-center text-[12px] text-mute sm:block">
                    {team.won}-{team.drawn}-{team.lost}
                  </span>
                  <span className="num hidden w-14 shrink-0 text-center text-[12px] text-mute sm:block">
                    {team.goalsFor}:{team.goalsAgainst}
                  </span>
                  <span className="num w-16 shrink-0 text-right text-[13px] text-mute">
                    {formatTotal(team.fantapoints)}
                  </span>
                  <span className="num w-8 shrink-0 text-right text-[19px] font-extrabold">
                    {team.points}
                  </span>
                  <span className="shrink-0 text-[13px] text-faint">›</span>
                </Link>
              ))}
            </>
          )}
        </div>

        <div className="gutter pt-8">
          <Link href="/" className="link-underline text-[13px] text-mute">
            ← {t("pub.back")}
          </Link>
        </div>
      </section>
    </>
  );
}
