"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveVersion } from "@/hooks/useLive";
import type { MatchDetail, MatchSide } from "@/lib/fanta/official";
import { LineupPitch } from "./LineupPitch";
import { useT } from "./LocaleProvider";
import { Loading, Reveal, Section } from "./ui";

type Named = MatchSide & { name: string; logo: string | null };
type Payload = Omit<MatchDetail, "home" | "away"> & {
  home: Named;
  away: Named;
  error?: string;
};

export function MatchView({
  alias,
  matchweek,
  teamA,
  teamB,
}: {
  alias: string;
  matchweek: string;
  teamA: string;
  teamB: string;
}) {
  const t = useT();
  const { tick } = useLiveVersion();
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "missing">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/real/${alias}/match/${matchweek}/${teamA}/${teamB}`)
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, status, body }) => {
        if (cancelled) return;
        if (ok) {
          setData(body as Payload);
          setState("ok");
        } else setState(status === 401 ? "denied" : "missing");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [alias, matchweek, teamA, teamB, tick?.version]);

  const back = (
    <Link
      href={`/lega-pubblica/${alias}/giornata/${matchweek}`}
      className="link-underline text-[13px] text-mute"
    >
      ← {t("mw.title", { n: Number(matchweek) })}
    </Link>
  );

  if (state === "loading") return <Loading label={t("pitch.loading")} />;

  if (state !== "ok" || !data) {
    return (
      <section className="gutter pt-10 md:pt-16">
        {back}
        <h1 className="display mt-5 text-[clamp(26px,7vw,48px)]">
          {t("pitch.lineups")}
        </h1>
        <div className="mt-5 rounded-2xl border border-[var(--line)] bg-ground-2 p-5">
          <p className="text-[13px] leading-relaxed text-mute">
            {state === "denied" ? t("pitch.needSignIn") : t("pitch.unavailable")}
          </p>
          {state === "denied" ? (
            <Link
              href="/lega-reale"
              className="tap mt-4 inline-block rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-ground"
            >
              {t("squad.signIn")}
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="gutter pt-10 md:pt-16">
        <Reveal>
          {back}
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <span className="truncate text-right text-[15px] font-semibold md:text-[18px]">
              {data.home.name}
            </span>
            <span className="num shrink-0 text-[30px] font-extrabold md:text-[40px]">
              {data.result || "–"}
            </span>
            <span className="truncate text-[15px] font-semibold md:text-[18px]">
              {data.away.name}
            </span>
          </div>
        </Reveal>
      </section>

      <section className="pt-10">
        <Section title={t("pitch.lineups")} hint={t("pitch.starting")} />
        <div className="gutter mt-5 grid gap-5 lg:grid-cols-2">
          <LineupPitch side={data.home} />
          <LineupPitch side={data.away} />
        </div>
      </section>
    </>
  );
}
