"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

// A thin top progress bar that animates during route changes, so navigation
// always feels responsive even while the next page is still loading. Starts on
// an internal link click, finishes when the pathname actually changes.
export function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = React.useState(0);
  const [active, setActive] = React.useState(false);
  const started = React.useRef(false);
  const startedAt = React.useRef(0);
  const ramp = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const hideT = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = React.useCallback(() => {
    started.current = true;
    startedAt.current = Date.now();
    if (ramp.current) clearInterval(ramp.current);
    if (hideT.current) clearTimeout(hideT.current);
    setActive(true);
    setWidth(12);
    ramp.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + Math.max(0.8, (90 - w) * 0.08) : w));
    }, 90);
  }, []);

  const finish = React.useCallback(() => {
    // Keep the bar on screen long enough to be seen even on instant navigations.
    const wait = Math.max(0, 480 - (Date.now() - startedAt.current));
    hideT.current = setTimeout(() => {
      if (ramp.current) clearInterval(ramp.current);
      setWidth(100);
      hideT.current = setTimeout(() => {
        setActive(false);
        setWidth(0);
      }, 220);
    }, wait);
  }, []);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || /^(https?:|mailto:|tel:)/.test(href)) return;
      if (href === pathname) return;
      start();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, start]);

  // pathname changed => the navigation we started has landed.
  React.useEffect(() => {
    if (!started.current) return;
    started.current = false;
    finish();
  }, [pathname, finish]);

  React.useEffect(
    () => () => {
      if (ramp.current) clearInterval(ramp.current);
      if (hideT.current) clearTimeout(hideT.current);
    },
    [],
  );

  if (!active && width === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      <div
        className="h-full bg-[var(--primary)] shadow-[0_0_12px_2px_rgba(255,255,255,0.6)] transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${width}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
