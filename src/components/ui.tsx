"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "./LocaleProvider";

/* ---------------------------------------------------------------- numbers */

export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatTotal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

/**
 * A number that springs to its new value instead of snapping. Used for the
 * scores that move while you are watching them.
 */
export function Ticker({
  value,
  decimals = 0,
  className = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const raw = useMotionValue(value);
  const spring = useSpring(raw, { stiffness: 180, damping: 26, mass: 0.7 });
  const text = useTransform(spring, (v) => v.toFixed(decimals));

  useEffect(() => {
    raw.set(value);
  }, [raw, value]);

  return <motion.span className={className}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ reveal */

/**
 * Fades and lifts content into place, offset by `delay` for staggered lists.
 *
 * Deliberately a CSS animation rather than a JS one: see the note on
 * `@keyframes reveal` in globals.css. Content must never be able to get stuck
 * invisible because no animation frame arrived.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`reveal ${className}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- indicators */

export function LivePip({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="pip" />
      {label ? (
        <span className="label !text-flare !text-[9px]">{label}</span>
      ) : null}
    </span>
  );
}

const ROLE_TONE: Record<string, string> = {
  P: "text-gold",
  D: "text-[#6fb3ff]",
  C: "text-acid",
  A: "text-flare",
};

export function Role({ role }: { role: string }) {
  return (
    <span
      className={`num w-3 shrink-0 text-[10px] font-bold ${ROLE_TONE[role] ?? "text-faint"}`}
    >
      {role}
    </span>
  );
}

const MATCH_STATE = {
  "pre-match": { key: "match.pre", tone: "!text-faint" },
  live: { key: "match.live", tone: "!text-flare" },
  finished: { key: "match.finished", tone: "!text-mute" },
  suspended: { key: "match.suspended", tone: "!text-gold" },
  postponed: { key: "match.postponed", tone: "!text-gold" },
} as const;

export function MatchState({ state }: { state: string }) {
  const t = useT();
  const entry =
    MATCH_STATE[state as keyof typeof MATCH_STATE] ?? MATCH_STATE["pre-match"];
  return (
    <span className="inline-flex items-center gap-1.5">
      {state === "live" ? <span className="pip" /> : null}
      <span className={`label ${entry.tone}`}>{t(entry.key)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ layout */

export function Section({
  title,
  titleNode,
  hint,
  right,
  className = "",
}: {
  title: string;
  /** Rich replacement for `title`; `title` stays as the accessible text. */
  titleNode?: ReactNode;
  hint?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`gutter flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${className}`}
    >
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="display text-[22px] md:text-[26px]">
          {titleNode ?? title}
        </h2>
        {hint ? (
          <p className="mt-1.5 text-[12px] leading-snug text-faint">{hint}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="gutter py-12 text-center text-[13px] text-faint">
      {children}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-acid"
            animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.14,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {label ? <p className="label">{label}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative flex rounded-full border border-[var(--line)] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className="tap relative z-10 flex-1 whitespace-nowrap px-4 py-1.5"
          >
            {active ? (
              <motion.span
                layoutId="segmented-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-full bg-paper"
              />
            ) : null}
            <span
              className={`label !text-[10px] transition-colors ${
                active ? "!text-ground" : "!text-mute"
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ bottom sheet */

/**
 * True once the viewport is wide enough for a docked panel.
 *
 * Deliberately wider than the `md` breakpoint: a panel beside the lineups needs
 * about 400px of its own, and taking that from a 768px tablet leaves the two
 * elevens too cramped to be worth keeping in view.
 *
 * Starts false so the server-rendered markup and the first client render agree,
 * then corrects immediately — the same trade the locale makes.
 */
function useWideViewport(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

/**
 * A panel over the page.
 *
 * `variant: "side"` docks it to the right on a wide screen and leaves the page
 * alone — no dimming, no click-catcher, no scroll lock — because the content
 * behind it is the point: you read a player's breakdown while still looking at
 * the lineup he came from, and tapping the next player just swaps the panel.
 * On a phone there is no room to sit beside anything, so both variants are the
 * same drag-to-dismiss bottom sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  variant = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  variant?: "center" | "side";
}) {
  const wide = useWideViewport();
  const docked = variant === "side" && wide;

  useEffect(() => {
    // A docked panel must not freeze the page it sits next to.
    if (!open || docked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, docked]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          {docked ? null : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-ground/70 backdrop-blur-sm"
            />
          )}
          <motion.div
            initial={docked ? { x: "100%" } : { y: "100%" }}
            animate={docked ? { x: 0 } : { y: 0 }}
            exit={docked ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            drag={docked ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose();
            }}
            className={
              docked
                ? "fixed bottom-0 right-0 top-0 z-50 flex w-[min(420px,40vw)] flex-col overflow-hidden border-l border-[var(--line)] bg-ground-2 shadow-[-18px_0_50px_-24px_rgba(0,0,0,0.45)]"
                : "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-hidden rounded-t-3xl border-t border-[var(--line)] bg-ground-2 md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:w-[min(680px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border"
            }
          >
            {docked ? null : (
              <div className="flex justify-center pt-2.5 md:hidden">
                <span className="h-1 w-9 rounded-full bg-fill-strong" />
              </div>
            )}
            {title ? (
              <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-3">
                {title}
                <button
                  onClick={onClose}
                  aria-label="Chiudi"
                  className="tap -mr-1 -mt-1 shrink-0 p-1 text-[18px] leading-none text-faint hover:text-ink"
                >
                  ✕
                </button>
              </div>
            ) : null}
            <div
              className={
                docked
                  ? "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6"
                  : "max-h-[calc(88dvh-72px)] overflow-y-auto overscroll-contain pb-[calc(20px+env(safe-area-inset-bottom))]"
              }
            >
              {children}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------- misc */

/** Copies text and briefly confirms, without a layout shift. */
export function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
      className="tap num rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold tracking-[0.2em] text-mute transition-colors hover:border-acid/50 hover:text-ink"
    >
      {copied ? "COPIATO" : text}
    </button>
  );
}
