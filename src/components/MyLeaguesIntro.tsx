"use client";

import { useT } from "./LocaleProvider";
import { RealEntry } from "./RealEntry";
import { Reveal } from "./ui";

export function MyLeaguesIntro() {
  const t = useT();

  return (
    <section className="gutter pt-10 md:pt-16">
      <Reveal>
        <p className="label">{t("picker.eyebrow")}</p>
        <h1 className="display mt-3 text-[clamp(36px,10vw,76px)]">
          {t("picker.title")}
        </h1>
      </Reveal>
      <Reveal delay={0.08}>
        <div className="mt-9 max-w-md">
          <RealEntry />
        </div>
      </Reveal>
    </section>
  );
}
