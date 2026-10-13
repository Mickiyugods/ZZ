"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  IconHome2,
  IconCompass,
  IconCards,
  IconRocket,
  IconWallet,
  IconLayoutGrid,
  IconUser,
  IconFolders,
} from "@tabler/icons-react";
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
  { href: "/", label: "Home", icon: IconHome2 },
  { href: "/explore", label: "Explore", icon: IconCompass },
];

const COLLECTIONS_GROUP: NavItemDef[] = [
  { href: "/cards", label: "Card Collections", icon: IconCards },
  { href: "/collections", label: "NFT Collections", icon: IconLayoutGrid },
];

const BOTTOM_NAV: NavItemDef[] = [
  { href: "/launch", label: "Launch", icon: IconRocket },
  { href: "/profile", label: "Profile", icon: IconUser },
];

const RAIL_WIDTH = 72;
const SIDEBAR_WIDTH = 252;
const PIN_KEY = "zeep.sidebar.pinned";
const OPEN_DELAY = 110;
const CLOSE_DELAY = 200;

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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--primary)] text-[16px] font-bold text-[var(--primary-foreground)]">
        Z
      </span>
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
        <IconRocket className="size-[18px]" stroke={1.75} />
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

// Accordion group (the "My Collections" section) — collapses/expands via
// the existing SidebarNested primitive. When the rail itself is collapsed
// to icons-only, it behaves like a single icon with a tooltip, same as a
// flat NavLink; hovering the rail expands it (see AppSidebar), at which
// point the chevron and sub-items become usable.
function NavGroup({
  label,
  icon: Icon,
  defaultOpen,
  active,
  children,
}: {
  label: string;
  icon: NavItemDef["icon"];
  defaultOpen: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  const { anchorRef, show, onEnter, onLeave } = useCollapsedTooltip(collapsed);

  return (
    <div ref={anchorRef} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <SidebarNested icon={<Icon className="size-[18px]" stroke={1.75} />} label={label} defaultOpen={defaultOpen} active={active}>
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

  const navItems = (
    <SidebarSection>
      {TOP_NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={navClick(item.href)} />
      ))}

      <NavGroup label="My Collections" icon={IconFolders} defaultOpen={collectionsActive} active={collectionsActive}>
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

      {BOTTOM_NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={navClick(item.href)} />
      ))}
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
      <div aria-hidden="true" className="hidden shrink-0 md:block" style={{ width: RAIL_WIDTH }} />
      <div
        className="fixed inset-y-0 left-0 z-[60] hidden md:block"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <Sidebar
          variant="collapsible"
          collapsed={!expanded}
          onCollapsedChange={(collapsed) => setPinnedPersist(!collapsed)}
          width={SIDEBAR_WIDTH}
          collapsedWidth={RAIL_WIDTH}
          aria-label="Main navigation"
          className={cn("h-screen", expanded && "shadow-[40px_0_60px_-30px_rgba(0,0,0,.6)]")}
        >
          <SidebarHeader>
            <Brand />
            <SidebarToggle className="ml-auto" onClick={() => setPinnedPersist(!pinned)} />
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
