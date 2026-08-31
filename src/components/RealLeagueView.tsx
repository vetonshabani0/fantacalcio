"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import { useT } from "./LocaleProvider";
import { Empty, Loading, LivePip, Reveal, Section, Ticker } from "./ui";

interface Standing {
  position: number;
  teamId: string;
  teamName: string;
  manager: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  fantapunti: number;
}

interface RealLeague {
  signedIn: boolean;
  league: { id: number; name: string; alias: string; type: number };
  competitions: { id: number; name: string }[];
  competitionId: number | null;
  matchweek: number;
  realMatchweek: number | null;
  live: boolean;
  standings: Standing[];
  error?: string;
}

export function RealLeagueView({ alias }: { alias: string }) {
  const { tick, connected } = useLiveVersion();
  const t = useT();
  const [competition, setCompetition] = useState<number | null>(null);

  const url = useMemo(
    () =>
      competition
        ? `/api/real/${alias}?competition=${competition}`
        : `/api/real/${alias}`,
    [alias, competition],
  );

  const { data, error, loading } = useLiveData<RealLeague>(url, tick?.version);

  if (error) {
    const needsAuth = /autenticat/i.test(error);
    return (
      <section className="gutter pt-16">
        <p className="label">Errore</p>
        <h1 className="display mt-3 text-[clamp(32px,9vw,64px)]">
          {needsAuth ? t("real.sessionExpired") : t("real.errorTitle")}
        </h1>
        <p className="mt-4 max-w-[42ch] text-[15px] text-mute">{error}</p>
        <Link
          href="/"
          className="tap mt-7 inline-block rounded-full bg-acid px-5 py-2.5 text-[14px] font-bold text-ground"
        >
          {needsAuth ? t("real.signInAgain") : t("real.backToLeagues")}
        </Link>
      </section>
    );
  }

  if (loading && !data) return <Loading label={t("real.loading")} />;
  if (!data) return null;

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label">{t("real.eyebrow", { alias: data.league.alias })}</p>
              <h1 className="display mt-3 text-[clamp(32px,9vw,72px)]">
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
            {t("real.matchweek", { n: data.matchweek })}
            {data.realMatchweek
              ? ` · ${t("real.serieA", { n: data.realMatchweek })}`
              : ""}
            {data.standings.length
              ? ` · ${t("real.teams", { n: data.standings.length })}`
              : ""}
          </p>

          {data.competitions.length > 1 ? (
            <div className="rail mt-5 !px-0">
              {data.competitions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCompetition(c.id)}
                  className={`tap shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold ${
                    (competition ?? data.competitionId) === c.id
                      ? "border-acid bg-acid text-ground"
                      : "border-[var(--line)] text-mute"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </Reveal>
      </section>

      <section className="pt-10">
        <Section title={t("real.standings")} hint={t("real.standingsHint")} />
        <div className="gutter mt-5">
          {data.standings.length === 0 ? (
            <Empty>{t("real.noStandings")}</Empty>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
                <span className="label w-5 text-right">#</span>
                <span className="label flex-1">{t("real.team")}</span>
                <span className="label w-14 text-right">{t("real.fantapoints")}</span>
                <span className="label w-8 text-right">{t("real.points")}</span>
              </div>
              {data.standings.map((row, i) => (
                <div
                  key={`${row.teamId}-${i}`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                  className="reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3"
                >
                  <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
                    {row.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {row.teamName}
                    </span>
                    <span className="block truncate text-[11px] text-faint">
                      {row.manager ? `${row.manager} · ` : ""}
                      {row.won}-{row.drawn}-{row.lost} · {row.goalsFor}:
                      {row.goalsAgainst}
                    </span>
                  </span>
                  <span className="num w-14 shrink-0 text-right text-[13px] text-mute">
                    <Ticker
                      value={row.fantapunti}
                      decimals={row.fantapunti % 1 === 0 ? 0 : 1}
                    />
                  </span>
                  <span className="num w-8 shrink-0 text-right text-[19px] font-extrabold">
                    {row.points}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
