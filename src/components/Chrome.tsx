"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

const TABS = [
  { href: "/", label: "Home", glyph: "◎" },
  { href: "/live", label: "Diretta", glyph: "◈" },
  ...(IS_STATIC
    ? []
    : [{ href: "/lega-reale", label: "Le mie leghe", glyph: "▤" }]),
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/lega-reale") return pathname.startsWith("/lega");
  return pathname.startsWith(href);
}

/**
 * Phones get a thumb-reachable tab bar pinned to the bottom; wider screens get
 * a conventional masthead. Only one of the two is ever mounted visibly.
 */
export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-ground/85 backdrop-blur-xl md:block">
        <div className="gutter mx-auto flex h-16 max-w-[1400px] items-center justify-between">
          <Link href="/" className="group flex items-baseline gap-2.5">
            <span className="display text-[19px] leading-none">Fanta</span>
            <span className="display text-[19px] leading-none text-acid">
              Live
            </span>
          </Link>
          <nav className="flex items-center gap-8">
            {TABS.filter((t) => t.href !== "/").map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`label link-underline !text-[11px] ${
                  isActive(pathname, tab.href) ? "!text-ink" : "hover:!text-ink"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-24">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-ground/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="tap relative flex flex-col items-center gap-1 py-3"
              >
                <span
                  className={`text-[15px] leading-none transition-colors ${
                    active ? "text-acid" : "text-faint"
                  }`}
                >
                  {tab.glyph}
                </span>
                <span
                  className={`label !text-[9px] transition-colors ${
                    active ? "!text-ink" : ""
                  }`}
                >
                  {tab.label}
                </span>
                {active ? (
                  <span className="absolute inset-x-[38%] top-0 h-px bg-acid" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
