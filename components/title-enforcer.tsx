"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Each page sets its own document.title (e.g. "Explore · ZEEP"), but Next's App
// Router re-applies the layout's metadata title during hydration, clobbering it
// back to the default. This keeps the page-set title in place: it records the
// last page-set title and, if anything reverts the tab to the plain default on
// a non-home route, re-applies it. No per-page wiring needed.

const DEFAULT = "ZEEP — memecoins with a reserve inside";

export function TitleEnforcer() {
  const path = usePathname();
  const lastGood = useRef("");

  useEffect(() => {
    lastGood.current = "";
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    const check = () => {
      const t = document.title;
      if (t && t !== DEFAULT) {
        lastGood.current = t;
        return;
      }
      if (path !== "/" && lastGood.current && document.title !== lastGood.current) {
        document.title = lastGood.current;
      }
    };

    check();
    const obs = new MutationObserver(check);
    obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, [path]);

  return null;
}
