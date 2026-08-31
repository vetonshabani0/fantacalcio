"use client";

import { motion } from "motion/react";
import { useFlash } from "@/hooks/useLive";
import type { SerializedStanding } from "@/lib/league-view";
import { useT } from "./LocaleProvider";
import { formatTotal, Ticker } from "./ui";

function Trend({ trend }: { trend: SerializedStanding["trend"] }) {
  if (trend === "up") return <span className="text-acid">▲</span>;
  if (trend === "down") return <span className="text-flare">▼</span>;
  return <span className="text-faint/60">·</span>;
}

function Row({
  row,
  highlighted,
  onSelect,
  showLive,
  index,
}: {
  row: SerializedStanding;
  highlighted: boolean;
  onSelect: (teamId: string) => void;
  showLive: boolean;
  index: number;
}) {
  const flash = useFlash(row.livePoints);

  return (
    <button
      onClick={() => onSelect(row.teamId)}
      style={{ animationDelay: `${index * 0.03}s` }}
      className={`reveal relative flex w-full items-center gap-3 border-b border-[var(--line-soft)] py-3 text-left ${flash}`}
    >
      {highlighted ? (
        <motion.span
          layoutId="standings-marker"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute -left-3 top-1 bottom-1 w-[2px] rounded-full bg-acid"
        />
      ) : null}

      <span className="num w-5 shrink-0 text-right text-[15px] font-extrabold text-mute">
        {row.position}
      </span>
      <span className="w-2.5 shrink-0 text-[8px]">
        <Trend trend={row.trend} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-semibold ${
            highlighted ? "text-acid" : ""
          }`}
        >
          {row.teamName}
        </span>
        <span className="block truncate text-[11px] text-faint">
          {row.manager ? `${row.manager} · ` : ""}
          {row.won}-{row.drawn}-{row.lost} · {row.goalsFor}:{row.goalsAgainst} ·{" "}
          {formatTotal(row.fantapunti)} fp
        </span>
      </span>

      {showLive ? (
        <span className="num w-14 shrink-0 text-right text-[15px] font-bold text-acid">
          {row.livePoints != null ? (
            <Ticker
              value={row.livePoints}
              decimals={row.livePoints % 1 === 0 ? 0 : 1}
            />
          ) : (
            "—"
          )}
        </span>
      ) : null}

      <span className="num w-8 shrink-0 text-right text-[19px] font-extrabold">
        {row.points}
      </span>
    </button>
  );
}

export function StandingsTable({
  standings,
  highlightTeamId,
  onSelect,
  showLive,
}: {
  standings: SerializedStanding[];
  highlightTeamId: string | null;
  onSelect: (teamId: string) => void;
  showLive: boolean;
}) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-[var(--line)] pb-1.5">
        <span className="label w-5 text-right">#</span>
        <span className="w-2.5" />
        <span className="label flex-1">{t("table.team")}</span>
        {showLive ? (
          <span className="label w-14 text-right !text-acid">
            {t("table.live")}
          </span>
        ) : null}
        <span className="label w-8 text-right">{t("table.points")}</span>
      </div>

      {standings.map((row, index) => (
        <Row
          key={row.teamId}
          row={row}
          index={index}
          highlighted={row.teamId === highlightTeamId}
          onSelect={onSelect}
          showLive={showLive}
        />
      ))}
    </div>
  );
}
