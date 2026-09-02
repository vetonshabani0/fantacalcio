"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { MatchweekRow, PublicTeam } from "@/lib/fanta/public-league";
import { useT } from "./LocaleProvider";
import { TeamBadge } from "./TeamBadge";
import { TeamSquad } from "./TeamSquad";
import { Empty, formatTotal, Loading, Reveal, Section } from "./ui";

interface Payload {
  league: { alias: string; competitionName: string; lastMatchweek: number };
  team: PublicTeam;
  opponent: PublicTeam | null;
  history: MatchweekRow[];
  opponentHistory: MatchweekRow[];
  teams: { id: number; name: string; logo: string | null }[];
  error?: string;
}

const RESULT_TONE: Record<string, string> = {
  V: "bg-acid text-ground",
  N: "bg-fill-strong text-mute",
  P: "bg-flare/25 text-flare",
};

function Stat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border-t border-[var(--line)] pt-3">
      <p className="label">{label}</p>
      <p className={`num mt-1.5 text-[24px] font-extrabold md:text-[28px] ${tone}`}>
        {value}
      </p>
    </div>
  );
}

export function PublicTeamView({
  alias,
  teamId,
}: {
  alias: string;
  teamId: string;
}) {
  const t = useT();
  const { tick } = useLiveVersion();
  const [vs, setVs] = useState<number | null>(null);

  const url = vs
    ? `/api/public/${alias}/team/${teamId}?vs=${vs}`
    : `/api/public/${alias}/team/${teamId}`;
  const { data, error, loading } = useLiveData<Payload>(url, tick?.version);

  const settled = useMemo(
    () => (data?.history ?? []).filter((r) => r.settled),
    [data],
  );

  const comparison = useMemo(() => {
    if (!data?.opponentHistory?.length) return null;
    let ahead = 0,
      behind = 0,
      level = 0;
    for (const row of settled) {
      const other = data.opponentHistory.find(
        (r) => r.matchweek === row.matchweek && r.settled,
      );
      if (!other) continue;
      if (row.fantapoints > other.fantapoints) ahead++;
      else if (row.fantapoints < other.fantapoints) behind++;
      else level++;
    }
    return { ahead, behind, level };
  }, [data, settled]);

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

  if (loading && !data) return <Loading label={t("team.loading")} />;
  if (!data) return null;

  const { team } = data;
  const avg = settled.length
    ? formatTotal(
        Math.round((team.fantapoints / settled.length) * 100) / 100,
      )
    : "—";

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          <Link
            href={`/lega-pubblica/${alias}`}
            className="link-underline text-[13px] text-mute"
          >
            ← {t("team.back")}
          </Link>

          <div className="mt-6 flex items-center gap-4">
            <TeamBadge logo={team.logo} name={team.name} size="lg" />
            <div className="min-w-0">
              <p className="label">{data.league.competitionName}</p>
              <h1 className="display mt-1.5 text-[clamp(26px,7vw,56px)]">
                {team.name}
              </h1>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label={t("team.position")} value={`${team.position}º`} />
            <Stat label={t("team.points")} value={team.points} tone="text-acid" />
            <Stat label={t("team.played")} value={team.played} />
            <Stat
              label={t("team.record")}
              value={`${team.won}-${team.drawn}-${team.lost}`}
            />
            <Stat
              label={t("team.goals")}
              value={`${team.goalsFor}:${team.goalsAgainst}`}
            />
            <Stat
              label={t("team.diff")}
              value={team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
            />
            <Stat
              label={t("team.fantapoints")}
              value={formatTotal(team.fantapoints)}
            />
            <Stat label={t("team.avg")} value={avg} />
            {team.penalty ? (
              <Stat
                label={t("team.penalty")}
                value={team.penalty}
                tone="text-flare"
              />
            ) : null}
          </div>
        </Reveal>
      </section>

      <TeamSquad alias={alias} teamId={teamId} />

      <section className="pt-14">
        <Section
          title={t("team.compare")}
          hint={t("team.compareHint")}
          right={
            <label className="flex items-center gap-2">
              <span className="label">{t("team.compareWith")}</span>
              <select
                value={vs ?? data.opponent?.id ?? ""}
                onChange={(e) => setVs(Number(e.target.value))}
                className="rounded-full border border-[var(--line)] bg-ground-3 px-3 py-1.5 text-[13px] font-semibold text-ink outline-none"
              >
                {data.teams
                  .filter((x) => x.id !== team.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
          }
        />

        {comparison && data.opponent ? (
          <div className="gutter mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            <span className="text-acid">
              {t("team.ahead", { n: comparison.ahead })}
            </span>
            <span className="text-mute">
              {t("team.tied", { n: comparison.level })}
            </span>
            <span className="text-flare">
              {t("team.behind", { n: comparison.behind })}
            </span>
          </div>
        ) : null}
      </section>

      <section className="pt-10">
        <Section title={t("team.season")} />
        <div className="gutter mt-5">
          {settled.length === 0 ? (
            <Empty>{t("team.noHistory")}</Empty>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
                <span className="label w-12">#</span>
                <span className="label w-8" />
                <span className="label flex-1">{t("team.fpShort")}</span>
                {data.opponent ? (
                  <span className="label w-20 shrink-0 truncate text-right">
                    {data.opponent.name}
                  </span>
                ) : null}
                <span className="label w-9 shrink-0 text-right">
                  {t("team.ptShort")}
                </span>
              </div>

              {settled.map((row, i) => {
                const other = data.opponentHistory.find(
                  (r) => r.matchweek === row.matchweek && r.settled,
                );
                const better = other && row.fantapoints > other.fantapoints;
                const worse = other && row.fantapoints < other.fantapoints;
                return (
                  <div
                    key={row.matchweek}
                    style={{ animationDelay: `${i * 0.04}s` }}
                    className="reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3"
                  >
                    <span className="num w-12 text-[13px] text-faint">
                      {t("team.matchweek", { n: row.matchweek })}
                    </span>
                    <span
                      title={
                        row.result === "V"
                          ? t("team.win")
                          : row.result === "P"
                            ? t("team.loss")
                            : t("team.draw")
                      }
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-black ${RESULT_TONE[row.result]}`}
                    >
                      {row.result}
                    </span>
                    <span
                      className={`num flex-1 text-[17px] font-extrabold ${
                        better ? "text-acid" : worse ? "text-flare" : "text-ink"
                      }`}
                    >
                      {formatTotal(row.fantapoints)}
                    </span>
                    {data.opponent ? (
                      <span className="num w-20 text-right text-[14px] text-mute">
                        {other ? formatTotal(other.fantapoints) : "—"}
                      </span>
                    ) : null}
                    <span className="num w-9 shrink-0 text-right text-[17px] font-extrabold">
                      {row.points}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <p className="gutter pt-6 text-[11.5px] leading-relaxed text-faint">
          {t("team.liveNote")}{" "}
          <Link href="/live" className="link-underline text-mute">
            {t("home.seeLive")}
          </Link>
        </p>
      </section>
    </>
  );
}
