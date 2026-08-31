import { RealEntry } from "@/components/RealEntry";
import { Reveal } from "@/components/ui";

export const metadata = { title: "Le mie leghe — FantaLive" };

export default function MyLeaguesPage() {
  return (
    <section className="gutter pt-10 md:pt-16">
      <Reveal>
        <p className="label">Le mie leghe</p>
        <h1 className="display mt-3 text-[clamp(36px,10vw,76px)]">
          Le tue leghe
          <br />
          reali
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
