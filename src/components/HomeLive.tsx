"use client";

import Link from "next/link";
import { useLiveBoard } from "@/hooks/useLive";
import { useT } from "./LocaleProvider";
import { MatchRail, ScoreMarquee } from "./MatchRail";
import { Reveal, Section } from "./ui";

/** The live strip and match rail on the home page. */
export function HomeLive() {
  const { data } = useLiveBoard();
  const t = useT();

  if (!data) {
    return <div className="h-[168px]" aria-hidden />;
  }

  return (
    <>
      <ScoreMarquee matches={data.matches} />

      <Reveal delay={0.05}>
        <div className="pt-10">
          <Section

            title={t("live.matchweek", { n: data.pointer.matchweek })}
            hint={t("live.realResults")}
            right={
              <Link href="/live" className="label link-underline !text-ink">
                {t("live.allVotes")}
              </Link>
            }
          />
          <div className="mt-4">
            <MatchRail matches={data.matches} />
          </div>
        </div>
      </Reveal>
    </>
  );
}
