"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ImportedFixture } from "@/lib/fanta/calendar-import";
import { clearCalendar, saveCalendar } from "@/lib/calendar-storage";
import { useT } from "./LocaleProvider";

export function CalendarImport({
  alias,
  hasCalendar,
  onChange,
}: {
  alias: string;
  hasCalendar: boolean;
  onChange: (fixtures: ImportedFixture[] | null) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((b: { signedIn?: boolean }) => setSignedIn(!!b.signedIn))
      .catch(() => setSignedIn(false));
  }, []);

  /** Same result as the upload, fetched with the member's own session. */
  async function fromAccount() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/real/${alias}/calendar`, { method: "POST" });
      const json = (await res.json()) as {
        fixtures?: ImportedFixture[];
        matchweeks?: number;
        source?: string;
        error?: string;
      };
      if (!res.ok || !json.fixtures?.length) {
        setError(json.error ?? "Import failed.");
        return;
      }
      saveCalendar(alias, json.fixtures);
      onChange(json.fixtures);
      setNote(
        `${t("cal.imported", { n: json.fixtures.length, w: json.matchweeks ?? 0 })} ${
          json.source === "api" ? t("cal.sourceApi") : t("cal.sourceExcel")
        }`,
      );
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/public/${alias}/calendar`, {
        method: "POST",
        body,
      });
      const json = (await res.json()) as {
        fixtures?: ImportedFixture[];
        matchweeks?: number;
        error?: string;
      };
      if (!res.ok || !json.fixtures?.length) {
        setError(json.error ?? "Import failed.");
        return;
      }
      saveCalendar(alias, json.fixtures);
      onChange(json.fixtures);
      setNote(
        t("cal.imported", {
          n: json.fixtures.length,
          w: json.matchweeks ?? 0,
        }),
      );
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-ground-2 p-4 md:p-5">
      <p className="label !text-acid">{t("cal.title")}</p>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-mute">
        {t("cal.why")}
      </p>
      <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-faint">
        {t("cal.how")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="tap rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-ground disabled:opacity-40"
        >
          {busy ? t("cal.parsing") : t("cal.choose")}
        </button>

        {hasCalendar ? (
          <button
            onClick={() => {
              clearCalendar(alias);
              onChange(null);
              setNote(null);
            }}
            className="tap label rounded-full border border-[var(--line)] px-3 py-2 hover:!text-ink"
          >
            {t("cal.remove")}
          </button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="label">{t("cal.orSignIn")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {signedIn ? (
            <button
              onClick={fromAccount}
              disabled={busy}
              className="tap rounded-full border border-acid/45 bg-acid/10 px-4 py-2 text-[13px] font-bold text-acid disabled:opacity-40"
            >
              {busy ? t("cal.fetching") : t("cal.fromAccount")}
            </button>
          ) : (
            <>
              <span className="text-[12px] text-faint">
                {t("cal.needSignIn")}
              </span>
              <Link
                href="/lega-reale"
                className="tap label rounded-full border border-[var(--line)] px-3 py-2 hover:!text-ink"
              >
                {t("cal.signIn")}
              </Link>
            </>
          )}
        </div>
      </div>

      {note ? <p className="mt-3 text-[13px] text-acid">{note}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-flare">{error}</p> : null}
    </div>
  );
}
