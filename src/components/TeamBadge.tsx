"use client";

const SIZES = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-16 w-16" } as const;

/** A fantasy team's own badge, falling back to its initial. */
export function TeamBadge({
  logo,
  name,
  size = "sm",
}: {
  logo: string | null;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const box = `${SIZES[size]} shrink-0 rounded-full`;
  if (!logo) {
    return (
      <span
        className={`${box} grid place-items-center bg-white/8 text-[11px] font-bold text-mute`}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" aria-hidden loading="lazy" className={`${box} object-cover`} />
  );
}
