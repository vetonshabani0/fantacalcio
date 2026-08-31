"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";

export default function NotFound() {
  const t = useT();

  return (
    <section className="gutter flex flex-col items-start gap-5 pt-24">
      <p className="label">404</p>
      <h1 className="display text-[clamp(40px,12vw,88px)]">
        {t("error.notFound")}
      </h1>
      <p className="max-w-[38ch] text-[15px] text-mute">
        {t("error.notFoundBody")}
      </p>
      <Link
        href="/"
        className="tap rounded-full bg-acid px-5 py-2.5 text-[14px] font-bold text-ground"
      >
        {t("error.home")}
      </Link>
    </section>
  );
}
