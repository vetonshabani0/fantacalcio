"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DICTIONARIES,
  detectLocale,
  interpolate,
  LOCALES,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";

const STORAGE_KEY = "fantalive.locale";

export type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Locale lives on the client, in localStorage.
 *
 * The first render always uses Italian so the server-rendered markup and the
 * first client render agree; the stored or browser-detected choice is applied
 * immediately afterwards. Putting the locale in the URL would avoid that single
 * frame, but it would also break the static export, which has no server to
 * negotiate a redirect.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("it");

  useEffect(() => {
    let next: Locale | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && (LOCALES as readonly string[]).includes(stored)) {
        next = stored as Locale;
      }
    } catch {
      // Private mode or blocked storage: fall back to detection.
    }
    setLocaleState(next ?? detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => interpolate(DICTIONARIES[locale][key], vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside a LocaleProvider");
  }
  return context;
}

/** Shorthand for components that only need the translate function. */
export function useT(): Translate {
  return useLocale().t;
}

/** BCP-47 tag for Intl formatting. */
export function intlLocale(locale: Locale): string {
  return locale === "it" ? "it-IT" : "en-GB";
}
