"use client";

import type { LiveStandingRow, LiveTable } from "@/lib/fanta/live-table";
import { useT } from "./LocaleProvider";
import { TeamBadge } from "./TeamBadge";
import { formatTotal, LivePip, Section, Ticker } from "./ui";

const MOVEMENT = {
  up: { glyph: "▲", tone: "text-acid" },
  down: { glyph: "▼", tone: "text-flare" },
  same: { glyph: "·", tone: "text-faint" },
} as const;

/**
 * The one line a manager actually reads: am I winning, and by how much.
 *
 * With an opponent known it is a margin or a target — "3.5 ahead", "2.0 to go
 * in front". Without one there is still something honest to say: how far off the
 * next goal this team is, which needs no fixture at all.
 */
function Verdict({ row }: { row: LiveStandingRow }) {
  const t = useT();
  const round = row.round;
  if (!round) return null;

  if (round.opponent && round.toLead != null) {
    if (round.toLead === 0) {
      return (
        <span className="text-acid">
          {t("lt.leadingBy", { n: formatTotal(Math.abs(round.margin ?? 0)) })}
        </span>
      );
    }
    return (
      <span className="text-gold">
        {t("lt.needToLead", { n: formatTotal(round.toLead) })}
      </span>
    );
  }

  return (
    <span className="text-faint">
      {t("est.toNextGoal", { n: formatTotal(round.toNextGoal) })}
    </span>
  );
}

function Row({ row, index }: { row: LiveStandingRow; index: number }) {
  const t = useT();
  const move = MOVEMENT[row.movement];
  const round = row.round;

  return (
    <div
      style={{ animationDelay: `${index * 0.035}s` }}
      className="reveal flex items-center gap-3 border-b border-[var(--line-soft)] py-3"
    >
      <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
        {row.position}
      </span>
      <span
        aria-label={t(`lt.${row.movement}`)}
        className={`w-3 shrink-0 text-[9px] ${move.tone}`}
      >
        {move.glyph}
      </span>
      <TeamBadge logo={row.logo} name={row.name} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {row.name}
        </span>
        <span className="block truncate text-[11px]">
          {round?.opponent ? (
            <span className="text-faint">
              {t("lt.vs", { name: round.opponent.name })}{" "}
              <span className="num text-mute">
                {round.goals}–{round.opponent.goals}
              </span>
              {" · "}
            </span>
          ) : null}
          <Verdict row={row} />
        </span>
      </span>

      <span className="num w-16 shrink-0 text-right">
        <span className="block text-[15px] font-extrabold">
          {round ? (
            <Ticker
              value={round.fantapoints}
              decimals={round.fantapoints % 1 === 0 ? 0 : 1}
            />
          ) : (
            "—"
          )}
        </span>
        <span className="block text-[10px] text-faint">
          {formatTotal(row.fantapoints)}
        </span>
      </span>

      <span className="num w-9 shrink-0 text-right">
        <span className="block text-[19px] font-extrabold">{row.points}</span>
        {round?.points != null ? (
          <span
            className={`block text-[10px] ${round.points === 3 ? "text-acid" : round.points === 0 ? "text-flare" : "text-faint"}`}
          >
            +{round.points}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The table with the round in progress folded in.
 *
 * Two modes, and the difference is stated rather than hidden. With the fixtures
 * imported the positions are what they would be if the round ended now. Without
 * them the standings points cannot move — nobody knows who beat whom — so the
 * points column stays at its settled value and only the fantapoints are live.
 */
export function LiveTableBoard({ table }: { table: LiveTable }) {
  const t = useT();

  return (
    <section className="pt-12">
      <Section
        title={t("lt.title")}
        hint={t("lt.hint", { n: table.matchweek })}
        right={
          <span className="flex items-center gap-2.5">
            <LivePip label={t("est.live")} />
            <span className="label rounded-full border border-gold/40 px-2.5 py-1 !text-gold">
              {t("est.badge")}
            </span>
          </span>
        }
      />

      <div className="gutter mt-5">
        {!table.exact ? (
          <p className="mb-4 rounded-xl border border-gold/25 bg-gold/[0.06] p-3 text-[11.5px] leading-relaxed text-gold">
            {t("lt.provisional")}
          </p>
        ) : null}

        <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
          <span className="label w-5 text-right">#</span>
          <span className="w-3" />
          <span className="w-7" />
          <span className="label flex-1">{t("mw.team")}</span>
          <span className="label w-16 text-right">{t("lt.roundTotal")}</span>
          <span className="label w-9 text-right">{t("mw.points")}</span>
        </div>

        {table.rows.map((row, i) => (
          <Row key={row.teamId} row={row} index={i} />
        ))}

        <p className="pt-3 text-[11px] leading-relaxed text-faint">
          {t("lt.legend")}
        </p>
      </div>
    </section>
  );
}
