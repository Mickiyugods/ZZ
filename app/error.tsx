"use client";

import * as React from "react";
import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

// Route-level error boundary: a page crash shows this (inside the normal
// sidebar/footer shell) instead of a blank screen, with a one-click retry.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto flex min-h-[60dvh] max-w-[560px] flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Something broke</p>
      <h1 className="mt-3 text-[32px] sm:text-[38px]">This page hit an error.</h1>
      <p className="mt-3 text-[var(--muted-foreground)]">
        It&apos;s on our side, not yours. Try again — if it keeps happening, the rest of ZEEP still works.
      </p>
      {error.digest && <p className="mt-3 font-mono-tabular text-[12px] text-[var(--muted-foreground)]">Ref {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className={`inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5] ${focusRing}`}
        >
          Try again
        </button>
        <Link href="/" className={`inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-6 text-[14px] font-semibold transition-colors hover:border-white/40 ${focusRing}`}>
          Back to home
        </Link>
      </div>
    </section>
  );
}
