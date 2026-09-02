"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeagueRef } from "./SignIn";
import { useT } from "./LocaleProvider";
import { Reveal } from "./ui";

const TYPE_LABEL: Record<number, string> = { 1: "Classic", 2: "Mantra" };

/** Search across the real leagues this account belongs to. */
export function LeaguePicker({
  leagues,
  username,
  onSignOut,
}: {
  leagues: LeagueRef[];
  username: string;
  onSignOut: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leagues;
    return leagues.filter(
      (l) =>
        l.name.toLowerCase().includes(needle) ||
        l.alias.toLowerCase().includes(needle),
    );
  }, [leagues, query]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">
          {t(
            leagues.length === 1 ? "picker.count_one" : "picker.count_other",
            { n: leagues.length, user: username },
          )}
        </p>
        <span className="flex shrink-0 items-center gap-4">
          <a
            href="/api/real/debug"
            target="_blank"
            rel="noreferrer"
            title={t("picker.diagnosticsTitle")}
            className="tap label hover:!text-ink"
          >
            {t("picker.diagnostics")}
          </a>
          <button onClick={onSignOut} className="tap label hover:!text-ink">
            {t("picker.signOut")}
          </button>
        </span>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("picker.search")}
        aria-label={t("picker.search")}
        autoCapitalize="off"
        className="mt-4 w-full border-b border-[var(--line)] bg-transparent pb-3 text-[18px] font-medium text-ink outline-none transition-colors placeholder:text-faint focus:border-acid md:text-[20px]"
      />

      <div className="mt-2">
        {matches.length === 0 ? (
          <p className="py-8 text-[13px] text-faint">
            {t("picker.noMatch")}
          </p>
        ) : (
          matches.map((league, i) => (
            <Reveal key={league.id} delay={i * 0.04}>
              <Link
                href={`/lega-pubblica/${league.alias}`}
                className="tap flex items-center gap-4 border-b border-[var(--line-soft)] py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">
                    {league.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-faint">
                    {league.alias}
                    {TYPE_LABEL[league.type]
                      ? ` · ${TYPE_LABEL[league.type]}`
                      : ""}
                    {league.isAdmin ? ` · ${t("picker.admin")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-acid">→</span>
              </Link>
            </Reveal>
          ))
        )}
      </div>
    </div>
  );
}
