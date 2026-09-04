"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveVersion } from "@/hooks/useLive";
import type { BoardPlayer } from "@/lib/api-types";
import type { LineupSlot, MatchDetail, MatchSide } from "@/lib/fanta/official";
import { LineupPitch } from "./LineupPitch";
import { PlayerSheet } from "./PlayerSheet";
import { useT } from "./LocaleProvider";
import { formatPoints, Loading, Reveal, Section } from "./ui";

type Named = MatchSide & { name: string; logo: string | null };
type Payload = Omit<MatchDetail, "home" | "away"> & {
  home: Named;
  away: Named;
  /** Per-player bonus/malus detail, keyed by player id. */
  breakdowns?: Record<number, BoardPlayer>;
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
  const [selected, setSelected] = useState<BoardPlayer | null>(null);

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

  /** A slot only opens if the feed had something to say about that player. */
  const open = (slot: LineupSlot) => {
    const player = data?.breakdowns?.[slot.playerId];
    if (player) setSelected(player);
  };

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

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[var(--line)] bg-ground-2 p-4 md:p-6">
            {[data.home, data.away].map((side, i) => (
              <div
                key={side.teamId}
                className={`min-w-0 ${i === 1 ? "order-3 text-right" : ""}`}
              >
                <div
                  className={`flex items-center gap-2 ${i === 1 ? "flex-row-reverse" : ""}`}
                >
                  {side.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={side.logo}
                      alt=""
                      aria-hidden
                      className="h-8 w-8 shrink-0 rounded-full object-cover md:h-10 md:w-10"
                    />
                  ) : null}
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight md:text-[18px]">
                    {side.name}
                  </span>
                </div>
                <p className="num mt-2 text-[26px] font-extrabold leading-none md:text-[34px]">
                  {formatPoints(side.total)}
                </p>
                <p className="label mt-1">
                  {side.points} {side.points === 1 ? "pt" : "pts"}
                </p>
              </div>
            ))}

            <div className="order-2 shrink-0 px-1 text-center">
              <p className="num text-[26px] font-extrabold leading-none md:text-[44px]">
                {data.result || "–"}
              </p>
              <p className="label mt-1.5">
                {t("mw.title", { n: data.matchweek })}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="pt-10">
        <Section title={t("pitch.lineups")} hint={t("pitch.starting")} />
        {/* Two-up at every width: the point of this screen is comparison. */}
        <div className="gutter mt-5 grid grid-cols-2 gap-2 sm:gap-4 md:gap-5">
          <LineupPitch side={data.home} onSelect={open} />
          <LineupPitch side={data.away} onSelect={open} />
        </div>
      </section>

      <PlayerSheet player={selected} onClose={() => setSelected(null)} />
    </>
  );
}
