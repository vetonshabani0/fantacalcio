"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Option {
  href: string;
  team: string;
  manager: string;
  league: string;
  code: string;
}

type Result =
  | { kind: "league"; href: string; name: string }
  | { kind: "team"; href: string; name: string; league: string }
  | { kind: "ambiguous"; options: Option[] }
  | { kind: "none" };

export function EntryForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setOptions(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/entry?q=${encodeURIComponent(trimmed)}`);
      const result = (await res.json()) as Result;

      if (result.kind === "league" || result.kind === "team") {
        router.push(result.href);
        return;
      }
      if (result.kind === "ambiguous") {
        setOptions(result.options);
        return;
      }
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="group relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Codice o squadra"
          aria-label="Codice lega, nome squadra o nome manager"
          enterKeyHint="go"
          autoCapitalize="characters"
          autoCorrect="off"
          className="w-full border-b border-[var(--line)] bg-transparent pb-3 pr-20 text-[18px] font-medium text-ink outline-none transition-colors placeholder:text-faint focus:border-acid md:pr-24 md:text-[22px]"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="tap absolute bottom-2.5 right-0 flex items-center gap-1.5 disabled:opacity-30"
        >
          <span className="label !text-[10px] !text-ink">
            {busy ? "Cerco" : "Entra"}
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
        {notFound ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-[13px] text-gold"
          >
            Nessuna lega trovata.{" "}
            <a href="/lega/nuova" className="link-underline">
              Creane una
            </a>
            .
          </motion.p>
        ) : null}

        {options ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <p className="label mb-2">Più squadre corrispondono</p>
            {options.map((option) => (
              <a
                key={option.href}
                href={option.href}
                className="tap flex items-center justify-between gap-4 border-b border-[var(--line)] py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {option.team}
                  </span>
                  <span className="block truncate text-[12px] text-faint">
                    {option.manager ? `${option.manager} · ` : ""}
                    {option.league}
                  </span>
                </span>
                <span className="num shrink-0 text-[11px] tracking-widest text-faint">
                  {option.code}
                </span>
              </a>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
