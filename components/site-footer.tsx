import Link from "next/link";
import { IconArrowUpRight, IconArrowUp } from "@tabler/icons-react";
import { CHAIN, PONS } from "@/lib/config";
import { SocialLinks } from "@/components/social-links";

const focusRing =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

type FooterLink = { label: string; href: string; external?: boolean };

// Only real destinations. Social accounts live in SOCIAL (lib/config.ts) and
// render via <SocialLinks> in the brand column.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Explore coins", href: "/explore" },
      { label: "Launch a coin", href: "/launch" },
      { label: "Gacha Station", href: "/gacha" },
      { label: "Card collections", href: "/cards" },
      { label: "NFT collections", href: "/collections" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Contracts", href: "/contracts" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Pons", href: PONS.site, external: true },
      { label: "Robinhood Chain explorer", href: CHAIN.explorer, external: true },
      { label: "Collector Crypt", href: "https://collectorcrypt.com", external: true },
    ],
  },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  const cls = `group text-[14px] text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] ${focusRing}`;
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {link.label}
        {/* inline (not flex) so the arrow stays glued to the last word when the label wraps */}
        <IconArrowUpRight className="ml-1 inline-block size-3.5 align-[-2px] opacity-50 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px group-hover:opacity-100 motion-reduce:transition-none" stroke={1.75} aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={cls}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-[var(--border)]">
      {/* launch band */}
      <div className="mx-auto max-w-[1180px] px-6 pt-14">
        <div className="flex flex-col gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[#141414] to-[var(--card)] p-7 sm:p-9 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[520px]">
            <p className="font-display text-[26px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[32px]">A coin with a reserve inside.</p>
            <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--muted-foreground)]">
              Launch on Robinhood Chain through Pons, pair it with a collection, and let every trade build the reserve.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/launch"
              className={`inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5] ${focusRing}`}
            >
              Launch a coin
            </Link>
            <Link
              href="/docs"
              className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-6 text-[14px] font-semibold transition-colors hover:border-white/40 ${focusRing}`}
            >
              How it works
            </Link>
          </div>
        </div>
      </div>

      {/* brand + link columns */}
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-6 gap-y-10 px-6 pb-10 pt-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-[300px] md:col-span-1">
          <Link href="/" className={`inline-flex items-center gap-2.5 ${focusRing}`} aria-label="ZEEP home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/zeep-logo.png" alt="" width={34} height={31} className="h-[31px] w-auto" />
            <span className="font-display text-[20px] font-bold tracking-[-0.01em]">ZEEP</span>
          </Link>
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            Memecoins with a reserve inside. Every coin is a real Pons launch on Robinhood Chain, paired with an NFT or graded-card collection.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">Built on Pons</span>
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">Robinhood Chain</span>
          </div>
          <SocialLinks className="mt-5" />
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <FooterAnchor link={l} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* oversized wordmark — pure decoration */}
      <div aria-hidden className="pointer-events-none mx-auto max-w-[1180px] select-none overflow-hidden px-6">
        <p
          className="font-display text-[clamp(96px,26vw,320px)] font-bold leading-[0.78] tracking-[-0.06em] text-transparent"
          style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.26)", maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)" }}
        >
          ZEEP
        </p>
      </div>

      {/* legal bar */}
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-6 py-6 text-[12px] text-[var(--muted-foreground)] md:flex-row md:items-center md:justify-between">
          <p>© {year} ZEEP. Coins launched here are experimental and can lose all value. Nothing here is financial advice.</p>
          <a href="#main-content" className={`inline-flex items-center gap-1.5 self-start font-semibold transition-colors hover:text-[var(--foreground)] md:self-auto ${focusRing}`}>
            <IconArrowUp className="size-3.5" stroke={2} aria-hidden />
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
