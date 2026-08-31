import Link from "next/link";

export default function NotFound() {
  return (
    <section className="gutter flex flex-col items-start gap-5 pt-24">
      <p className="label">404</p>
      <h1 className="display text-[clamp(40px,12vw,88px)]">
        Pagina
        <br />
        non trovata
      </h1>
      <p className="max-w-[38ch] text-[15px] text-mute">
        Il codice lega potrebbe essere sbagliato, oppure la lega è stata
        rimossa.
      </p>
      <Link
        href="/"
        className="tap rounded-full bg-acid px-5 py-2.5 text-[14px] font-bold text-ground"
      >
        Torna alla home
      </Link>
    </section>
  );
}
