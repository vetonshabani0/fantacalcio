"use client";

import Link from "next/link";
import { useLiveData, useLiveVersion } from "@/hooks/useLive";
import type { LiveBoard } from "@/lib/api-types";
import { MatchRail, ScoreMarquee } from "./MatchRail";
import { Reveal, Section } from "./ui";

/** The live strip and match rail on the home page. */
export function HomeLive() {
  const { tick } = useLiveVersion();
  const { data } = useLiveData<LiveBoard>("/api/live", tick?.version);

  if (!data) {
    return <div className="h-[168px]" aria-hidden />;
  }

  return (
    <>
      <ScoreMarquee matches={data.matches} />

      <Reveal delay={0.05}>
        <div className="pt-10">
          <Section
            title={`Giornata ${data.pointer.matchweek}`}
            hint="I risultati reali che alimentano il calcolo della tua lega"
            right={
              <Link href="/live" className="label link-underline !text-ink">
                Tutti i voti →
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
