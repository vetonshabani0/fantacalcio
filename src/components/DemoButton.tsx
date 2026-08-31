"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./LocaleProvider";

/** Drafts a league from real Serie A players and drops the user straight into it. */
export function DemoButton({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/league", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });
      const body = (await res.json()) as { code?: string };
      if (body.code) router.push(`/lega/${body.code}`);
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button onClick={create} disabled={busy} className={className}>
      {busy ? t("build.demoBusy") : children}
    </button>
  );
}
