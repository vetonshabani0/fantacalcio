"use client";

import { useState } from "react";
import { crestUrl } from "@/lib/fanta/crests";

const SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

/**
 * A club crest, falling back to the club's initial when there is no artwork for
 * that id (a newly promoted side) or the image fails to load.
 */
export function Crest({
  teamId,
  teamName,
  size = "md",
  className = "",
  eager = false,
}: {
  teamId: number;
  teamName: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Load immediately. Use where there are few crests and they carry meaning. */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = crestUrl(teamId);
  const box = `${SIZES[size]} shrink-0 ${className}`;

  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={`${box} grid place-items-center rounded-full bg-fill text-[9px] font-bold text-mute`}
      >
        {teamName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // A plain img: these are third-party assets and the static export ships
    // without an image optimiser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={`${box} object-contain`}
    />
  );
}
