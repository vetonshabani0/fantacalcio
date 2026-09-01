"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "./LocaleProvider";
import { Reveal } from "./ui";

interface Result {
  alias: string;
  name: string;
  teamCount: number;
  president: string;
  readable: boolean;
}

/** Search real leagues by name. No account, no sign-in. */
export function PublicSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2 || busy) return;

    setBusy(true);
    setResults(null);
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { results: Result[] };
      setResults(body.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pub.searchPlaceholder")}
          aria-label={t("pub.searchTitle")}
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full border-b border-[var(--line)] bg-transparent pb-3 pr-20 text-[18px] font-medium text-ink outline-none transition-colors placeholder:text-faint focus:border-acid md:pr-24 md:text-[22px]"
        />
        <button
          type="submit"
          disabled={busy || query.trim().length < 2}
          className="tap absolute bottom-2.5 right-0 flex items-center gap-1.5 disabled:opacity-30"
        >
          <span className="label !text-[10px] !text-ink">
            {busy ? t("pub.searching") : t("pub.openLeague")}
          </span>
          <motion.span
            animate={busy ? { x: [0, 4, 0] } : { x: 0 }}
            transition={{ repeat: busy ? Infinity : 0, duration: 0.9 }}
            className="text-acid"
          >
            →
          </motion.span>
        </button>
      </form>

      <AnimatePresence mode="wait">
        {results && results.length === 0 ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-[13px] text-gold"
          >
            {t("pub.noResults")}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {results && results.length > 0 ? (
        <div className="mt-4">
          {results.map((r, i) => (
            <Reveal key={r.alias} delay={i * 0.05}>
              <Link
                href={`/lega-pubblica/${r.alias}`}
                className="tap flex items-center gap-4 border-b border-[var(--line-soft)] py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">
                    {r.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-faint">
                    {r.alias}
                    {r.teamCount ? ` · ${t("pub.teams", { n: r.teamCount })}` : ""}
                    {r.president
                      ? ` · ${t("pub.president", { name: r.president })}`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-acid">→</span>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : null}
    </div>
  );
}
