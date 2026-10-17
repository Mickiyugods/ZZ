import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const LINKS = [
  { href: "/explore", label: "Explore coins" },
  { href: "/launch", label: "Launch a coin" },
  { href: "/gacha", label: "Gacha Station" },
  { href: "/docs", label: "Docs" },
];

export default function NotFound() {
  return (
    <section className="relative mx-auto flex min-h-[70dvh] max-w-[1180px] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <p
        aria-hidden
        className="zeep-rise pointer-events-none select-none font-display text-[clamp(140px,30vw,320px)] font-bold leading-[0.8] tracking-[-0.06em] text-transparent"
        style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.28)" }}
      >
        404
      </p>
      <h1 className="zeep-rise mt-6 text-[32px] sm:text-[40px]" style={{ animationDelay: "60ms" }}>
        This page isn&apos;t on the curve.
      </h1>
      <p className="zeep-rise mt-3 max-w-[440px] text-[var(--muted-foreground)]" style={{ animationDelay: "120ms" }}>
        The link may be old, or the coin address mistyped. Every coin page lives at <span className="font-mono-tabular text-[var(--foreground)]">/coin/0x…</span>.
      </p>
      <div className="zeep-rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "180ms" }}>
        <Link href="/" className={`inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5] ${focusRing}`}>
          Back to home
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors hover:border-white/40 ${focusRing}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
