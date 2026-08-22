"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "./logo-mark";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { Jaali, JaaliField } from "./jaali";
import { ThemeToggle } from "./theme-toggle";
import { PushToggle } from "./push-toggle";
import {
  LeaveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  CloseIcon,
} from "./icons";
import { signOutAction } from "@/app/actions";
import { EASE_OUT_EXPO } from "@/lib/motion";

/**
 * The universal application shell: a collapsible desktop sidebar plus a mobile
 * drawer. Shared by both the parent portal and the staff console so the
 * navigation pattern stays identical across every view.
 */
export function AppShell({
  navItems,
  subtitle,
  accountName,
  footer,
  childSwitcher,
  children,
}: {
  navItems: NavItem[];
  /** Small uppercase label under the brand, e.g. "Parent Portal". */
  subtitle: string;
  /** Name shown in the sidebar footer (guardian or staff member). */
  accountName: string;
  /** Optional page footer rendered beneath the content column. */
  footer?: React.ReactNode;
  /** Optional sidebar-footer control (e.g. the parent portal's child switcher).
   * Staff console has no "child" concept, so `StaffShell` simply omits it. */
  childSwitcher?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  return (
    <div className="relative isolate flex min-h-dvh">
      {/* Decorative jaali — a seamless lattice covers the whole field (slowly
          drifting). Two large star-rosettes turn in opposite corners, each on
          an opaque disc so it occludes the lattice (a rosette in its own
          clearing). Generously spaced so they never overlap. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <JaaliField />
        <Jaali size="min(46vw, 30rem)" className="-right-24 -top-28" spin breathe solid />
        <Jaali size="min(40vw, 26rem)" className="-bottom-28 -left-24" spin="reverse" breathe solid />
      </div>

      {/* ---- Desktop sidebar --------------------------------------------- */}
      <aside
        className={`sticky top-0 z-[var(--z-sticky)] hidden h-dvh shrink-0 border-r border-hairline bg-surface/95 backdrop-blur-sm transition-[width] duration-300 lg:flex ${
          collapsed ? "w-[4.75rem]" : "w-64"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          navItems={navItems}
          subtitle={subtitle}
          accountName={accountName}
          childSwitcher={childSwitcher}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* ---- Mobile drawer ----------------------------------------------- */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[var(--z-toast)] lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.aside
              className="absolute left-0 top-0 flex h-dvh w-72 max-w-[82vw] border-r border-hairline bg-surface shadow-[var(--shadow-pop)]"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              <SidebarContent
                collapsed={false}
                navItems={navItems}
                subtitle={subtitle}
                accountName={accountName}
                childSwitcher={childSwitcher}
                onNavigate={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ---- Content column ---------------------------------------------- */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger. */}
        <header className="sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-sm p-1.5 text-maroon hover:bg-mist"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <LogoMark size={30} />
          <p className="font-heading text-base text-maroon">Manthan Vidyashram</p>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-[clamp(1rem,4vw,2rem)] py-[clamp(1.75rem,4vw,3rem)]">
          {children}
        </main>

        {footer}
      </div>
    </div>
  );
}

/** The shared inner content of the sidebar, used by both desktop rail and mobile drawer. */
function SidebarContent({
  collapsed,
  navItems,
  subtitle,
  accountName,
  childSwitcher,
  onToggleCollapse,
  onNavigate,
  onClose,
}: {
  collapsed: boolean;
  navItems: NavItem[];
  subtitle: string;
  accountName: string;
  childSwitcher?: React.ReactNode;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex w-full flex-col">
      <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,var(--color-fill-maroon),var(--color-rust),var(--color-fill-maroon))]" />

      {/* Brand + collapse / close control. */}
      <div className={`flex items-center gap-2.5 px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
        <LogoMark size={collapsed ? 34 : 38} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-heading text-base text-maroon">Manthan Vidyashram</p>
            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate">{subtitle}</p>
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto rounded-sm p-1.5 text-slate hover:bg-mist hover:text-maroon"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1">
        <SidebarNav items={navItems} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      {/* Footer: theme, account, sign out. */}
      <div className="mt-auto border-t border-hairline px-2.5 py-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3 py-1">
            <PushToggle collapsed />
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-sm p-1.5 text-rust hover:bg-mist"
              >
                <LeaveIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {childSwitcher}
            <div className="flex items-center gap-2 px-1">
              <div className="min-w-0 flex-1 text-sm leading-tight">
                <p className="truncate font-semibold text-slate-strong">{accountName}</p>
                <form action={signOutAction}>
                  <button type="submit" className="text-rust underline-offset-2 hover:underline">
                    Sign out
                  </button>
                </form>
              </div>
              <ThemeToggle />
            </div>
            <PushToggle />
          </div>
        )}
      </div>

      {/* Desktop-only collapse toggle. */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2 border-t border-hairline px-3 py-2.5 text-sm text-slate transition hover:bg-mist hover:text-maroon ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeftIcon className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
