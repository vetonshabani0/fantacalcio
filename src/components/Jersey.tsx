"use client";

import { useId } from "react";
import { kitFor, type Kit } from "@/lib/fanta/kits";

/** Shirt silhouette: body, both sleeves and a collar notch. */
const SHIRT =
  "M20 8 L7 16 L11 32 L19 28 L19 57 Q32 61 45 57 L45 28 L53 32 L57 16 L44 8 " +
  "Q38 15 32 15 Q26 15 20 8 Z";

function Pattern({ kit }: { kit: Kit }) {
  const { pattern, primary, secondary = primary, bands = 6 } = kit;

  if (pattern === "stripes") {
    const width = 64 / bands;
    return (
      <>
        <rect x="0" y="0" width="64" height="64" fill={primary} />
        {Array.from({ length: bands }, (_, i) =>
          i % 2 === 1 ? (
            <rect
              key={i}
              x={i * width}
              y="0"
              width={width}
              height="64"
              fill={secondary}
            />
          ) : null,
        )}
      </>
    );
  }

  if (pattern === "halves") {
    return (
      <>
        <rect x="0" y="0" width="32" height="64" fill={primary} />
        <rect x="32" y="0" width="32" height="64" fill={secondary} />
      </>
    );
  }

  if (pattern === "hoops") {
    const height = 64 / bands;
    return (
      <>
        <rect x="0" y="0" width="64" height="64" fill={primary} />
        {Array.from({ length: bands }, (_, i) =>
          i % 2 === 1 ? (
            <rect
              key={i}
              x="0"
              y={i * height}
              width="64"
              height={height}
              fill={secondary}
            />
          ) : null,
        )}
      </>
    );
  }

  if (pattern === "sash") {
    return (
      <>
        <rect x="0" y="0" width="64" height="64" fill={primary} />
        <path d="M-8 46 L44 -8 L62 -8 L4 60 Z" fill={secondary} />
      </>
    );
  }

  return <rect x="0" y="0" width="64" height="64" fill={primary} />;
}

export function Jersey({
  teamId,
  className = "",
}: {
  teamId: number;
  className?: string;
}) {
  const kit = kitFor(teamId);
  // Clip paths are document-scoped, so each shirt needs its own id.
  const clipId = useId();

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <clipPath id={clipId}>
          <path d={SHIRT} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <Pattern kit={kit} />
        {kit.sleeve ? (
          <>
            <path d="M20 8 L7 16 L11 32 L19 28 Z" fill={kit.sleeve} />
            <path d="M44 8 L57 16 L53 32 L45 28 Z" fill={kit.sleeve} />
          </>
        ) : null}
        {kit.accent ? (
          <path
            d="M20 8 Q26 15 32 15 Q38 15 44 8 L44 12 Q38 19 32 19 Q26 19 20 12 Z"
            fill={kit.accent}
          />
        ) : null}
      </g>

      <path
        d={SHIRT}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
