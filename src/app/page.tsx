import Link from "next/link";
import { HomeLive } from "@/components/HomeLive";
import { RealEntry } from "@/components/RealEntry";
import { Reveal } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <section className="gutter pt-12 md:pt-20">
        <Reveal>
          <p className="label">Serie A · in diretta</p>
        </Reveal>

        <Reveal delay={0.06}>
          <h1 className="display mt-5 text-[clamp(46px,14vw,132px)]">
            La tua lega,
            <br />
            <span className="text-acid">davvero</span>
            <br />
            in diretta.
          </h1>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mt-7 max-w-[46ch] text-[15px] leading-relaxed text-mute md:text-[17px]">
            Accedi con il tuo account Fantacalcio, scegli la tua lega e guarda
            classifica, scontro diretto e sostituzioni muoversi mentre si gioca.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10 max-w-md">
            <RealEntry />
          </div>
        </Reveal>
      </section>

      <div className="pt-16">
        <HomeLive />
      </div>

      <section className="gutter pt-16">
        <div className="border-t border-[var(--line)] pt-6">
          <p className="text-[12px] leading-relaxed text-faint">
            Le leghe si leggono dai backend ufficiali di Leghe Fantacalcio, che
            richiedono l&apos;accesso: non esiste alcun endpoint pubblico per
            cercare o leggere una lega, nemmeno per le leghe pubbliche. I voti e
            i risultati di Serie A arrivano invece dal feed pubblico usato dal
            sito ufficiale.{" "}
            <Link href="/live" className="link-underline text-mute">
              Vedi la diretta
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
