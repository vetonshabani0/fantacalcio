/**
 * Prepares an export-only copy of the app and builds it for GitHub Pages.
 *
 * Pages serves static files, so everything that needs a server has to go: the
 * API routes, the SSE poller, the file-backed local leagues and the
 * authenticated real-league pages. What survives is the live Serie A board,
 * which reads the public feed straight from the browser.
 *
 * The copy keeps the real source tree untouched, so a static build can never
 * quietly change what the server build does.
 */
import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, ".static-build");
const basePath = process.env.STATIC_BASE_PATH ?? "/fantacalcio";

const COPY = [
  "src",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
];

/** Route trees that cannot exist without a server. */
const DROP = [
  "src/app/api",
  "src/app/lega",
  "src/app/lega-reale",
  "src/app/lega-pubblica",
  "src/lib/store.ts",
  "src/lib/demo.ts",
  "src/lib/auth-session.ts",
  "src/lib/live-hub.ts",
  "src/lib/league-view.ts",
  "src/lib/fanta/official.ts",
  "src/components/CreateLeague.tsx",
  "src/components/LeagueDashboard.tsx",
  "src/components/HeadToHead.tsx",
  "src/components/Pitch.tsx",
  "src/components/StandingsTable.tsx",
  "src/components/LineupEditor.tsx",
  "src/lib/fanta/public-league.ts",
  "src/components/PublicSearch.tsx",
  "src/components/PublicLeagueView.tsx",
  "src/components/PublicTeamView.tsx",
  "src/components/MatchweekView.tsx",
  "src/components/CalendarImport.tsx",
  "src/lib/calendar-storage.ts",
  "src/lib/fanta/calendar-import.ts",
  "src/components/TeamBadge.tsx",
  "src/components/RealEntry.tsx",
  "src/components/MyLeaguesIntro.tsx",
  "src/components/RealLeagueView.tsx",
  "src/components/LeaguePicker.tsx",
  "src/components/SignIn.tsx",
  "src/components/DemoButton.tsx",
  "src/components/EntryForm.tsx",
];

const LANDING = `"use client";

import Link from "next/link";
import { HomeLive } from "@/components/HomeLive";
import { useT } from "@/components/LocaleProvider";
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
            {t("home.staticTitle1")}
            <br />
            <span className="text-acid">{t("home.staticTitle2")}</span>
            <br />
            {t("home.staticTitle3")}
          </h1>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mt-7 max-w-[46ch] text-[15px] leading-relaxed text-mute md:text-[17px]">
            {t("home.staticLead")}
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <Link
            href="/live"
            className="tap mt-9 inline-block rounded-full bg-acid px-6 py-3 text-[15px] font-bold text-ground"
          >
            {t("home.staticCta")}
          </Link>
        </Reveal>
      </section>

      <div className="pt-16">
        <HomeLive />
      </div>

      <section className="gutter pt-16">
        <div className="border-t border-[var(--line)] pt-6">
          <p className="max-w-[70ch] text-[12px] leading-relaxed text-faint">
            {t("home.staticNote")}{" "}
            <a
              className="link-underline text-mute"
              href="https://github.com/vetonshabani0/fantacalcio"
            >
              GitHub
            </a>
            {t("home.staticNoteEnd")}{" "}
            <span className="text-mute">pnpm dev</span>{" "}
            {t("home.staticNoteEnd2")}
          </p>
        </div>
      </section>
    </>
  );
}
`;

async function run(cmd, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        STATIC_EXPORT: "1",
        STATIC_BASE_PATH: basePath,
        NEXT_PUBLIC_STATIC: "1",
      },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of COPY) {
  await cp(path.join(root, entry), path.join(out, entry), { recursive: true });
}

for (const entry of DROP) {
  await rm(path.join(out, entry), { recursive: true, force: true });
}

await writeFile(path.join(out, "src/app/page.tsx"), LANDING, "utf8");

// Reuse the installed dependencies rather than resolving them twice.
if (!existsSync(path.join(out, "node_modules"))) {
  await symlink(
    path.join(root, "node_modules"),
    path.join(out, "node_modules"),
    "dir",
  );
}

// Pages would otherwise try to run the output through Jekyll.
await run("npx", ["next", "build"], out);
await writeFile(path.join(out, "out", ".nojekyll"), "", "utf8");

console.log(`\nStatic site ready: ${path.join(out, "out")} (basePath "${basePath}")`);
