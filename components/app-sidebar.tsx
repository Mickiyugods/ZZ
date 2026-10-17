"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { IconPin, IconPinFilled, IconWallet } from "@tabler/icons-react";
import {
  HomeIcon,
  ExploreIcon,
  FoldersIcon,
  CardStackIcon,
  NftCardIcon,
  RocketIcon,
} from "@/components/icons/zeep-icons";

// Custom ZEEP sidebar icons (Gacha, Resources, Docs, Contracts, FAQ) supplied
// as white-on-transparent PNGs. Rendered as a CSS mask over `bg-current` so the
// glyph takes the surrounding text color — matching the SVG icons' muted →
// white active/hover behavior exactly, with no recoloring needed per state.
function maskIcon(src: string) {
  function MaskIcon({ className }: { className?: string; stroke?: number }) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block shrink-0 bg-current", className)}
        style={{
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }
  return MaskIcon;
}

const GachaIcon = maskIcon("/images/icons/gacha.png");
const ResourcesIcon = maskIcon("/images/icons/resources.png");
const DocsIcon = maskIcon("/images/icons/docs.png");
const ContractsIcon = maskIcon("/images/icons/contracts.png");
const FaqIcon = maskIcon("/images/icons/faq.png");
import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarSection,
  SidebarItem,
  SidebarNested,
  SidebarFooter,
  SidebarToggle,
  useSidebar,
} from "@/components/ui/sidebar";
import { mobileSidebarStore } from "@/lib/mobileSidebarStore";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { short } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; stroke?: number }>;
}


const TOP_NAV: NavItemDef[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "Explore", icon: ExploreIcon },
  { href: "/gacha", label: "Gacha", icon: GachaIcon },
];

const COLLECTIONS_GROUP: NavItemDef[] = [
  { href: "/cards", label: "Card Collections", icon: CardStackIcon },
  { href: "/collections", label: "NFT Collections", icon: NftCardIcon },
];

const RESOURCES_GROUP: NavItemDef[] = [
  { href: "/docs", label: "Docs", icon: DocsIcon },
  { href: "/contracts", label: "Contracts", icon: ContractsIcon },
  { href: "/faq", label: "FAQ", icon: FaqIcon },
];

const RAIL_WIDTH = 72;
const SIDEBAR_WIDTH = 252;
const PIN_KEY = "zeep.sidebar.pinned";
const OPEN_DELAY = 110;
const CLOSE_DELAY = 200;

// Exclusive accordion: at most one of these two groups is open at a time.
type GroupKey = "collections" | "resources";

function groupForPathname(pathname: string): GroupKey | null {
  if (COLLECTIONS_GROUP.some((item) => pathname.startsWith(item.href))) return "collections";
  if (RESOURCES_GROUP.some((item) => pathname.startsWith(item.href))) return "resources";
  return null;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

function subscribeMobile(cb: () => void) {
  mobileSidebarStore.addEventListener("change", cb);
  return () => mobileSidebarStore.removeEventListener("change", cb);
}

function Brand() {
  const { collapsed } = useSidebar();
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-2.5 rounded-lg", focusRing)} onClick={() => mobileSidebarStore.hide()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brand/zeep-logo.png" alt="ZEEP" decoding="async" className="size-9 shrink-0 object-contain" />
      {!collapsed && <span className="truncate font-display text-[20px] font-bold">ZEEP</span>}
    </Link>
  );
}

function WalletButton() {
  const { collapsed } = useSidebar();
  const wallet = useWallet();
  const label = !wallet.connected ? "Connect wallet" : wallet.onChain ? short(wallet.address) : "Wrong network";
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={openWallet}
        aria-label={label}
        title={label}
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center self-center rounded-full",
          focusRing,
          !wallet.connected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] text-[var(--foreground)]",
        )}
      >
        <IconWallet className="size-[18px]" stroke={1.75} />
        {wallet.connected && (
          <span
            aria-hidden="true"
            className={cn("absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-[var(--background)]", wallet.onChain ? "bg-[var(--primary)]" : "bg-[var(--destructive)]")}
          />
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openWallet}
      className={cn(
        "flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold transition-colors",
        focusRing,
        !wallet.connected
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#e5e5e5]"
          : "border border-[var(--border)] hover:border-[var(--muted-foreground)]",
      )}
    >
      <span className={wallet.connected ? "font-mono-tabular" : ""}>{label}</span>
    </button>
  );
}

function LaunchCta() {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return (
      <Link
        href="/launch"
        onClick={() => mobileSidebarStore.hide()}
        aria-label="Launch a coin"
        title="Launch a coin"
        className={cn("flex size-11 items-center justify-center self-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#e5e5e5]", focusRing)}
      >
        <RocketIcon className="size-[18px]" stroke={1.75} />
      </Link>
    );
  }
  return (
    <Link
      href="/launch"
      onClick={() => mobileSidebarStore.hide()}
      className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-center text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5]", focusRing)}
    >
      Launch a coin
    </Link>
  );
}

function CtaWrap({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return <div className={cn("flex flex-col gap-2 pb-2", collapsed ? "items-center px-2" : "px-[18px]")}>{children}</div>;
}

// Shorter than OPEN_DELAY (110ms, below) — the rail itself expands and
// reveals the real label on hover, so the tooltip only has a brief window
// to be useful; it needs to beat that expansion to be seen at all.
const TOOLTIP_SHOW_DELAY = 40;

// Styled replacement for the native title-attribute tooltip the collapsed
// rail used to rely on (slow to appear — browsers wait ~700ms before
// showing a native title tooltip, well past the point the rail has already
// expanded — and inconsistent styling across browsers). Rendered via portal
// since SidebarNav clips overflow-x to keep the rail from widening, which
// would otherwise clip a tooltip extending past it.
function NavTooltip({ label, anchorRef, show }: { label: string; anchorRef: React.RefObject<HTMLElement | null>; show: boolean }) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!show || !anchorRef.current) {
      setPos(null);
      return;
    }
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 10 });
  }, [show, anchorRef]);

  if (!show || !pos || typeof document === "undefined") return null;

  return createPortal(
    <span
      role="tooltip"
      style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateY(-50%)" }}
      className="pointer-events-none z-[200] whitespace-nowrap rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
    >
      {label}
    </span>,
    document.body,
  );
}

// Shared by NavLink and NavGroup: shows a label-anchor ref + hover/focus
// state driving the fast collapsed-rail tooltip (see NavTooltip above).
function useCollapsedTooltip(collapsed: boolean) {
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const [show, setShow] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = React.useCallback(() => {
    if (!collapsed) return;
    timer.current = setTimeout(() => setShow(true), TOOLTIP_SHOW_DELAY);
  }, [collapsed]);
  const onLeave = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }, []);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { anchorRef, show, onEnter, onLeave };
}

function NavLink({ item, active, onClick }: { item: NavItemDef; active: boolean; onClick: (e: React.MouseEvent) => void }) {
  const { collapsed } = useSidebar();
  const { anchorRef, show, onEnter, onLeave } = useCollapsedTooltip(collapsed);

  return (
    <div ref={anchorRef} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <SidebarItem href={item.href} icon={<item.icon className="size-[18px]" stroke={1.75} />} active={active} onClick={onClick} className="min-h-11">
        {item.label}
      </SidebarItem>
      <NavTooltip label={item.label} anchorRef={anchorRef} show={collapsed && show} />
    </div>
  );
}

// Accordion group (the "My Collections" / "Resources" sections) — collapses/
// expands via the existing SidebarNested primitive, now in CONTROLLED mode
// (`open` + `onOpenChange` instead of `defaultOpen`) so AppSidebar can keep
// only one group open at a time — see `openGroup` there. When the rail
// itself is collapsed to icons-only, it behaves like a single icon with a
// tooltip, same as a flat NavLink; hovering the rail expands it (see
// AppSidebar), at which point the chevron and sub-items become usable.
function NavGroup({
  label,
  icon: Icon,
  open,
  onOpenChange,
  active,
  children,
}: {
  label: string;
  icon: NavItemDef["icon"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: boolean;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  const { anchorRef, show, onEnter, onLeave } = useCollapsedTooltip(collapsed);

  return (
    <div ref={anchorRef} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <SidebarNested icon={<Icon className="size-[18px]" stroke={1.75} />} label={label} open={open} onOpenChange={onOpenChange} active={active}>
        {children}
      </SidebarNested>
      <NavTooltip label={label} anchorRef={anchorRef} show={collapsed && show} />
    </div>
  );
}

function useNavClick(router: ReturnType<typeof useRouter>) {
  return React.useCallback(
    (href: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      mobileSidebarStore.hide();
      router.push(href);
    },
    [router],
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const navClick = useNavClick(router);
  const mobileOpen = useSyncExternalStore(subscribeMobile, () => mobileSidebarStore.open, () => false);

  // Exclusive accordion state: which of the two nav groups (if any) is open.
  // Initialized from the current route so a deep link lands with its parent
  // group already expanded, then kept in sync on every navigation — without
  // ever forcing a group closed just because the user browsed to a page
  // outside both groups (e.g. Home), only switching/opening on request.
  const [openGroup, setOpenGroup] = React.useState<GroupKey | null>(() => groupForPathname(pathname));
  React.useEffect(() => {
    const g = groupForPathname(pathname);
    if (g) setOpenGroup(g);
  }, [pathname]);

  // Desktop: a slim icon rail that expands into an overlay on hover (after a
  // short delay, so passing the cursor over it doesn't flash it open) or
  // stays open when pinned via the header toggle.
  const [pinned, setPinned] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {}
  }, []);

  const setPinnedPersist = React.useCallback((next: boolean) => {
    setPinned(next);
    try {
      localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {}
  }, []);

  // The header button is a pin toggle: it keeps the sidebar open (pushing the
  // page over) or returns it to the hover rail. pinAnim replays the "push the
  // pin in" animation on each user toggle — not on the initial restore.
  const [pinAnim, setPinAnim] = React.useState(0);
  const togglePin = React.useCallback(() => {
    setPinned((p) => {
      const next = !p;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
    setPinAnim((n) => n + 1);
  }, []);

  // "[" toggles the pin on desktop, like Linear/Notion — ignored while typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      e.preventDefault();
      togglePin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePin]);

  // Width transitions only after the saved pin state has been restored, so a
  // pinned visitor doesn't watch the page slide over on every load.
  const [layoutReady, setLayoutReady] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setLayoutReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const onEnter = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setHovering(true), OPEN_DELAY);
  }, []);
  const onLeave = React.useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setHovering(false), CLOSE_DELAY);
  }, []);
  // Keyboard users don't hover: expand immediately when focus enters the rail
  // (no open delay — that delay only exists to ignore incidental mouse passes),
  // and only collapse once focus actually leaves the whole sidebar subtree.
  const onFocus = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    setHovering(true);
  }, []);
  const onBlur = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    closeTimer.current = setTimeout(() => setHovering(false), CLOSE_DELAY);
  }, []);
  React.useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const expanded = pinned || hovering;

  const isActive = React.useCallback((href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href)), [pathname]);
  const collectionsActive = isActive("/cards") || isActive("/collections");
  const resourcesActive = RESOURCES_GROUP.some((item) => isActive(item.href));

  const navItems = (
    <SidebarSection>
      {TOP_NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={navClick(item.href)} />
      ))}

      <NavGroup
        label="My Collections"
        icon={FoldersIcon}
        open={openGroup === "collections"}
        onOpenChange={(next) => setOpenGroup(next ? "collections" : null)}
        active={collectionsActive}
      >
        {COLLECTIONS_GROUP.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={<item.icon className="size-[18px]" stroke={1.75} />}
            active={isActive(item.href)}
            onClick={navClick(item.href)}
            className="min-h-11"
          >
            {item.label}
          </SidebarItem>
        ))}
      </NavGroup>

      <NavGroup
        label="Resources"
        icon={ResourcesIcon}
        open={openGroup === "resources"}
        onOpenChange={(next) => setOpenGroup(next ? "resources" : null)}
        active={resourcesActive}
      >
        {RESOURCES_GROUP.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={<item.icon className="size-[18px]" stroke={1.75} />}
            active={isActive(item.href)}
            onClick={navClick(item.href)}
            className="min-h-11"
          >
            {item.label}
          </SidebarItem>
        ))}
      </NavGroup>
    </SidebarSection>
  );

  return (
    <>
      {/* ── mobile: hamburger-triggered drawer ─────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[1px] md:hidden" onClick={() => mobileSidebarStore.hide()} />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[60] transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar id="mobile-nav-drawer" variant="default" width={SIDEBAR_WIDTH} aria-label="Main navigation" className="h-dvh">
          <SidebarHeader>
            <Brand />
          </SidebarHeader>
          <SidebarNav>{navItems}</SidebarNav>
          <CtaWrap>
            <LaunchCta />
          </CtaWrap>
          <SidebarFooter className="flex-col items-stretch gap-2">
            <WalletButton />
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* ── desktop: rail that expands on hover or when pinned ─── */}
      {/* Reserves the sidebar's width in the page flow: the rail when unpinned (a
          hover-expanded sidebar floats over the page), the full width when pinned
          (it pushes the page over instead of covering it). */}
      <div
        aria-hidden="true"
        className={cn("hidden shrink-0 md:block", layoutReady && "transition-[width] duration-200 ease-out motion-reduce:transition-none")}
        style={{ width: pinned ? SIDEBAR_WIDTH : RAIL_WIDTH }}
      />
      <div
        className="fixed inset-y-0 left-0 z-[60] hidden md:block"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <Sidebar
          id="desktop-nav-rail"
          variant="collapsible"
          collapsed={!expanded}
          onCollapsedChange={(collapsed) => setPinnedPersist(!collapsed)}
          width={SIDEBAR_WIDTH}
          collapsedWidth={RAIL_WIDTH}
          aria-label="Main navigation"
          className={cn("h-screen", hovering && !pinned && "shadow-[40px_0_60px_-30px_rgba(0,0,0,.6)]")}
        >
          <SidebarHeader>
            <Brand />
            <SidebarToggle
              className={cn("group/pin relative ml-auto size-8", pinned ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}
              onClick={togglePin}
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              aria-pressed={pinned}
              aria-expanded={undefined}
              aria-keyshortcuts="["
            >
              <span key={pinAnim} className={cn("flex", pinAnim > 0 && "zeep-pin")}>
                {pinned ? <IconPinFilled className="size-[17px]" /> : <IconPin className="size-[17px]" stroke={1.75} />}
              </span>
              {/* fast styled tooltip (the native title tooltip waits ~700ms) */}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-10 mt-2 flex items-center gap-2 whitespace-nowrap rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-opacity duration-150 group-hover/pin:opacity-100 group-hover/pin:delay-150 group-focus-visible/pin:opacity-100"
              >
                {pinned ? "Unpin sidebar" : "Pin sidebar open"}
                <kbd className="rounded border border-[var(--border)] px-1.5 font-mono-tabular text-[11px] text-[var(--muted-foreground)]">[</kbd>
              </span>
            </SidebarToggle>
          </SidebarHeader>
          <SidebarNav>{navItems}</SidebarNav>
          <CtaWrap>
            <LaunchCta />
          </CtaWrap>
          <SidebarFooter className="flex-col items-stretch gap-2">
            <WalletButton />
          </SidebarFooter>
        </Sidebar>
      </div>
    </>
  );
}
