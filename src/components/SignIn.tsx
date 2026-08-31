"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./LocaleProvider";

export interface LeagueRef {
  id: number;
  name: string;
  alias: string;
  type: number;
  isAdmin: boolean;
}

const field =
  "w-full border-b border-[var(--line)] bg-transparent pb-3 text-[18px] font-medium text-ink outline-none transition-colors placeholder:text-faint focus:border-acid";

/**
 * Signs in with the user's own Leghe Fantacalcio account, which is the only way
 * to read a real league: every league route on the official backends rejects
 * anonymous callers.
 */
export function SignIn({
  onSignedIn,
}: {
  onSignedIn: (leagues: LeagueRef[], username: string) => void;
}) {
  const router = useRouter();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !username.trim() || !password) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = (await res.json()) as {
        leagues?: LeagueRef[];
        username?: string;
        error?: string;
      };

      if (!res.ok || body.error) {
        setError(body.error ?? t("auth.failed"));
        return;
      }
      setPassword("");
      onSignedIn(body.leagues ?? [], body.username ?? username);
      router.refresh();
    } catch {
      setError(t("auth.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <div className="space-y-7">
        <div>
          <label htmlFor="fc-user" className="label mb-2 block">
            {t("auth.username")}
          </label>
          <input
            id="fc-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="next"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="fc-pass" className="label mb-2 block">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="fc-pass"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              enterKeyHint="go"
              className={`${field} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="tap label absolute bottom-3 right-0 hover:!text-ink"
            >
              {show ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || !username.trim() || !password}
        className="tap mt-8 w-full rounded-full bg-acid px-6 py-3.5 text-[15px] font-bold text-ground disabled:opacity-30 sm:w-auto sm:px-8"
      >
        {busy ? t("auth.submitting") : t("auth.submit")}
      </button>

      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-[13px] text-flare"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <p className="mt-7 border-t border-[var(--line)] pt-5 text-[12px] leading-relaxed text-faint">
        {t("auth.privacy")}
      </p>
    </form>
  );
}
