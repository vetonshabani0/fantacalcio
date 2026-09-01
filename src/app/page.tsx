"use client";

import Link from "next/link";
import { HomeLive } from "@/components/HomeLive";
import { useT } from "@/components/LocaleProvider";
import { PublicSearch } from "@/components/PublicSearch";
import { Reveal } from "@/components/ui";

export default function HomePage() {
  const t = useT();

  return (
    <>
      <section className="gutter pt-12 md:pt-20">
        <Reveal>
          <p className="label">{t("home.eyebrow")}</p>
        </Reveal>

        <Reveal delay={0.06}>
          <h1 className="display mt-5 text-[clamp(46px,14vw,132px)]">
            {t("home.title1")}
            <br />
            <span className="text-acid">{t("home.title2")}</span>
            <br />
            {t("home.title3")}
          </h1>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mt-7 max-w-[46ch] text-[15px] leading-relaxed text-mute md:text-[17px]">
            {t("pub.hint")}
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10 max-w-xl">
            <PublicSearch />
          </div>
        </Reveal>

        <Reveal delay={0.24}>
          <p className="mt-6 text-[13px] text-faint">
            <Link href="/lega-reale" className="link-underline text-mute">
              {t("nav.leagues")}
            </Link>{" "}
            ·{" "}
            <Link href="/live" className="link-underline text-mute">
              {t("home.seeLive")}
            </Link>
          </p>
        </Reveal>
      </section>

      <div className="pt-16">
        <HomeLive />
      </div>
    </>
  );
}
