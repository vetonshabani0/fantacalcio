"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";
import { useTheme } from "./ThemeProvider";

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

const TABS = [
  { href: "/", key: "nav.home" as const, glyph: "◎" },
  { href: "/live", key: "nav.live" as const, glyph: "◈" },
  ...(IS_STATIC
    ? []
    : [{ href: "/lega-reale", key: "nav.leagues" as const, glyph: "▤" }]),
];

function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const t = useT();
  const next = theme === "dark" ? t("nav.light") : t("nav.dark");

  return (
    <button
      onClick={toggle}
      aria-label={`${t("nav.theme")}: ${next}`}
      title={`${t("nav.theme")}: ${next}`}
      className={
        compact
          ? "tap flex flex-col items-center gap-1 py-3"
          : "tap grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-mute transition-colors hover:text-ink"
      }
    >
      <span
        className={
          compact
            ? "text-[15px] leading-none text-faint"
            : "text-[13px] leading-none"
        }
        aria-hidden
      >
        {theme === "dark" ? "☀" : "☾"}
      </span>
      {compact ? (
        <span className="label !text-[9px]">{t("nav.theme")}</span>
      ) : null}
    </button>
  );
}

function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const { t } = useLocale();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5"
      role="group"
      aria-label={t("nav.language")}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`tap rounded-full px-2 py-1 text-[10px] font-bold tracking-widest transition-colors ${
            locale === code
              ? "bg-paper text-ground"
              : "text-faint hover:text-ink"
          }`}
        >
          {LOCALE_LABEL[code]}
        </button>
      ))}
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/lega-reale") return pathname.startsWith("/lega-reale");
  return pathname.startsWith(href);
}

/**
 * Phones get a thumb-reachable tab bar pinned to the bottom; wider screens get
 * a conventional masthead. Only one of the two is ever mounted visibly.
 */
function MobileLanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];

  return (
    <button
      onClick={() => setLocale(next)}
      aria-label={`${t("nav.language")}: ${LOCALE_LABEL[next]}`}
      className="tap flex flex-col items-center gap-1 py-3"
    >
      <span className="num text-[13px] font-bold leading-none text-acid">
        {LOCALE_LABEL[locale]}
      </span>
      <span className="label !text-[9px]">{t("nav.language")}</span>
    </button>
  );
}

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const t = useT();

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
            {TABS.filter((tab) => tab.href !== "/").map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`label link-underline !text-[11px] ${
                  isActive(pathname, tab.href) ? "!text-ink" : "hover:!text-ink"
                }`}
              >
                {t(tab.key)}
              </Link>
            ))}
            <LanguageSwitch />
            <ThemeSwitch />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-24">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-ground/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${TABS.length + 2}, minmax(0, 1fr))`,
          }}
        >
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
                  {t(tab.key)}
                </span>
                {active ? (
                  <span className="absolute inset-x-[38%] top-0 h-px bg-acid" />
                ) : null}
              </Link>
            );
          })}

          <MobileLanguageSwitch />
          <ThemeSwitch compact />
        </div>
      </nav>
    </>
  );
}
