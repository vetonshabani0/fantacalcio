"use client";

import { minuteLabel } from "@/lib/fanta/format";
import type { EventKind } from "@/lib/fanta/types";
import type { BoardPlayer } from "@/lib/api-types";
import { Crest } from "./Crest";
import { Jersey } from "./Jersey";
import { useT } from "./LocaleProvider";
import { formatPoints, Role, Sheet } from "./ui";

/** Full bonus/malus breakdown for one player. */
export function PlayerSheet({
  player,
  onClose,
}: {
  player: BoardPlayer | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Sheet
      open={!!player}
      onClose={onClose}
      variant="side"
      title={
        player ? (
          <div className="flex min-w-0 items-center gap-3">
            {/* The same shirt he is wearing on the pitch behind this panel. */}
            <Jersey
              teamId={player.teamId}
              goalkeeper={player.role === "P"}
              className="h-11 w-11 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Role role={player.role} />
                <h3 className="display-tight truncate text-[22px]">
                  {player.name}
                </h3>
              </div>
              <p className="label mt-1 flex items-center gap-1.5">
                <Crest
                  teamId={player.teamId}
                  teamName={player.teamName}
                  size="sm"
                />
                {player.teamName}
              </p>
            </div>
          </div>
        ) : null
      }
    >
      {player ? (
        <div className="px-5">
          <div className="grid grid-cols-3 gap-3 border-y border-[var(--line)] py-4">
            {[
              {
                label: t("player.grade"),
                value: player.grade != null ? formatPoints(player.grade) : "s.v.",
                tone: "text-ink",
              },
              {
                label: t("player.bonusMalus"),
                value:
                  player.bonus === 0
                    ? "—"
                    : `${player.bonus > 0 ? "+" : ""}${formatPoints(player.bonus)}`,
                tone:
                  player.bonus > 0
                    ? "text-acid"
                    : player.bonus < 0
                      ? "text-flare"
                      : "text-faint",
              },
              {
                label: t("player.fantavoto"),
                value:
                  player.fantavoto != null
                    ? formatPoints(player.fantavoto)
                    : "—",
                tone: "text-ink",
              },
            ].map((cell) => (
              <div key={cell.label}>
                <p className="label">{cell.label}</p>
                <p
                  className={`num mt-1.5 text-[30px] font-extrabold ${cell.tone}`}
                >
                  {cell.value}
                </p>
              </div>
            ))}
          </div>

          {player.breakdown.length ? (
            <div className="py-2">
              {player.breakdown.map((item) => (
                <div
                  key={item.kind}
                  className="flex items-center justify-between border-b border-[var(--line-soft)] py-2.5"
                >
                  <span className="text-[14px]">
                    {t(`event.${item.kind as EventKind}`)}
                    {item.count > 1 ? (
                      <span className="text-faint"> ×{item.count}</span>
                    ) : null}
                  </span>
                  <span
                    className={`num text-[15px] font-bold ${
                      item.points >= 0 ? "text-acid" : "text-flare"
                    }`}
                  >
                    {item.points > 0 ? "+" : ""}
                    {formatPoints(item.points)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-faint">
              {t("player.noBonus")}
            </p>
          )}

          {player.events.length ? (
            <div className="pb-4 pt-2">
              <p className="label pb-2">{t("player.timeline")}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {player.events.map((event, i) => (
                  <span
                    key={`${event.kind}-${i}`}
                    className="text-[12px] text-mute"
                  >
                    <span className="num text-faint">
                      {minuteLabel(event.minute)}
                    </span>{" "}
                    {t(`event.${event.kind}`)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {!player.hasVote && player.matchState === "pre-match" ? (
            <p className="pb-4 text-[12px] text-faint">
              {t("player.startChance", { n: player.startProbability })}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
