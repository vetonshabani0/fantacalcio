"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveVersion } from "@/hooks/useLive";
import { Crest } from "./Crest";
import { useT } from "./LocaleProvider";
import { Empty, formatPoints, Loading, Role, Section } from "./ui";

interface SquadPlayer {
  id: number;
  name: string;
  club: string;
  clubId: number;
  role: "P" | "D" | "C" | "A";
  cost: number;
  averageFantaGrade: number;
  live: {
    grade: number | null;
    bonus: number;
    fantavoto: number | null;
    hasVote: boolean;
    startProbability: number;
    matchState: string;
    teamId: number;
  } | null;
}

interface Payload {
  /** Which reading this was: the league API, or the public statistics service. */
  source: "league" | "public";
  team: { id: number; name: string; manager: string; creditsLeft: number };
  squad: SquadPlayer[];
  error?: string;
  signedIn?: boolean;
}

/**
 * The squad behind a fantasy team.
 *
 * Readable without an account: the statistics service returns a line per owned
 * player, which is the roster in all but name. Signing in adds what that service
 * does not carry — what each player cost and how many credits are left — so the
 * league API is still preferred when a session can reach this league.
 */
export function TeamSquad({
  alias,
  teamId,
}: {
  alias: string;
  teamId: string;
}) {
  const t = useT();
  const { tick } = useLiveVersion();
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/real/${alias}/squad/${teamId}`)
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, status, body }) => {
        if (cancelled) return;
        if (ok) {
          setData(body as Payload);
          setState("ok");
        } else setState(status === 401 || status === 404 ? "denied" : "error");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [alias, teamId, tick?.version]);

  if (state === "loading") return <Loading label={t("squad.loading")} />;

  if (state !== "ok" || !data) {
    return (
      <section className="pt-14">
        <Section title={t("squad.title")} />
        <div className="gutter mt-5 rounded-2xl border border-[var(--line)] bg-ground-2 p-5">
          <p className="text-[13px] leading-relaxed text-mute">
            {t("squad.unreadable")}
          </p>
          <Link
            href="/lega-reale"
            className="tap mt-4 inline-block rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-ground"
          >
            {t("squad.signIn")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-14">
      <Section
        title={t("squad.title")}
        hint={data.source === "public" ? t("squad.hintPublic") : t("squad.hint")}
        right={
          data.source === "league" ? (
            <span className="label">
              {t("squad.credits", { n: data.team.creditsLeft })}
            </span>
          ) : null
        }
      />

      <div className="gutter mt-5">
        {data.squad.length === 0 ? (
          <Empty>{t("squad.notInLeague")}</Empty>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
              <span className="w-3" />
              <span className="label flex-1">{t("squad.player2")}</span>
              {data.source === "league" ? (
                <span className="label w-10 text-right">{t("squad.cost")}</span>
              ) : null}
              <span className="label w-10 text-right">{t("squad.avg")}</span>
              <span className="label w-12 text-right">{t("squad.live")}</span>
            </div>

            {data.squad.map((p, i) => (
              <div
                key={p.id}
                style={{ animationDelay: `${i * 0.02}s` }}
                className="reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-2.5"
              >
                <Role role={p.role} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Crest teamId={p.clubId} teamName={p.club} size="sm" eager />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">
                      {p.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-faint">
                      {p.club}
                    </span>
                  </span>
                </span>
                {data.source === "league" ? (
                  <span className="num w-10 text-right text-[12px] text-faint">
                    {p.cost}
                  </span>
                ) : null}
                <span className="num w-10 text-right text-[12px] text-mute">
                  {p.averageFantaGrade ? p.averageFantaGrade.toFixed(1) : "—"}
                </span>
                <span
                  className={`num w-12 text-right text-[15px] font-extrabold ${
                    !p.live?.hasVote
                      ? "text-faint"
                      : p.live.bonus > 0
                        ? "text-acid"
                        : p.live.bonus < 0
                          ? "text-flare"
                          : "text-ink"
                  }`}
                >
                  {p.live?.fantavoto != null
                    ? formatPoints(p.live.fantavoto)
                    : "—"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
