import type { CSSProperties } from "react";
import { SOCIAL } from "@/lib/config";
import { cn } from "@/lib/utils";

// The X (formerly Twitter) mark, filled, so it reads as the real brand glyph
// rather than a generic outline icon.
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const ITEMS = [{ key: "x", label: "ZEEP on X", href: SOCIAL.x, Icon: XLogo }];

// Shared motion: color/border/transform ease together in 200ms; the glyph
// scales inside its ring on hover. Transforms drop out under reduced motion.
const base =
  "group flex size-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-[color,background-color,border-color,opacity,transform] duration-200 ease-out motion-reduce:transform-none";
const glyph = "size-4 transition-transform duration-200 ease-out motion-reduce:transform-none";

/** ZEEP's social icons. An account that isn't set in SOCIAL yet renders as a
 * visible but non-interactive "coming soon" icon. */
export function SocialLinks({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <ul className={cn("flex items-center gap-2", className)} style={style} aria-label="ZEEP on social media">
      {ITEMS.map(({ key, label, href, Icon }) => (
        <li key={key}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className={cn(
                base,
                // lift on hover, press-in on click
                "hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/[0.06] hover:text-[var(--foreground)] active:translate-y-0 active:scale-95 active:duration-75",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
              )}
            >
              <Icon className={cn(glyph, "group-hover:scale-110")} />
            </a>
          ) : (
            // not live yet: brightens a little on hover, but doesn't lift or press like a link
            <span
              role="img"
              aria-label={`${label} — coming soon`}
              title={`${label} — coming soon`}
              className={cn(base, "cursor-default opacity-60 hover:border-white/25 hover:text-[var(--foreground)] hover:opacity-90")}
            >
              <Icon className={cn(glyph, "group-hover:scale-105")} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
