import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--border)] py-9">
      <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-3 px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-display text-[18px] font-bold">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-[var(--primary)] text-[16px] font-bold text-[var(--primary-foreground)]">
            Z
          </span>
          ZEEP
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[var(--muted-foreground)]">
          <Link href="/explore" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:text-[var(--foreground)]">
            Explore
          </Link>
          <Link href="/cards" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:text-[var(--foreground)]">
            Card Collections
          </Link>
          <Link href="/launch" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:text-[var(--foreground)]">
            Launch
          </Link>
          <a
            href="https://www.ponsfamily.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:text-[var(--foreground)]"
          >
            Built on Pons
          </a>
          <a
            href="https://robinhoodchain.blockscout.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:text-[var(--foreground)]"
          >
            Explorer
          </a>
        </nav>
        <span className="text-[13px] text-[var(--muted-foreground)]">Coins launched here are experimental and can lose all value.</span>
      </div>
    </footer>
  );
}
