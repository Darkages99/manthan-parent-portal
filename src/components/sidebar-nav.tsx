"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "./icons";
import { useToast } from "./toast-provider";
import { copyTeacherToClass, moveStudentToClass } from "@/app/(staff)/console/classes/actions";

export type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
  /** Match only the exact href, not descendant routes. Needed for index links
   *  whose href is a prefix of every sibling (e.g. the staff `/console` dashboard). */
  exact?: boolean;
  /** Unread/new count shown as a red badge, e.g. unread messages. */
  badge?: number;
  /** Nested items rendered as a collapsible disclosure under this one. */
  children?: NavItem[];
  /** Set on a class's nav entry — turns it into a drop target for the
   * teacher/student drag cards on the class detail page (see class-detail.tsx). */
  classSectionId?: string;
};

const DRAG_MIME = "application/x-manthan-drag";

function isActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function badgeLabel(badge?: number): string | null {
  if (!badge || badge <= 0) return null;
  return badge > 99 ? "99+" : String(badge);
}

/** Vertical, icon-led navigation for the portal sidebar. Supports one level of
 * collapsible nesting (e.g. the staff PTMs group). */
export function SidebarNav({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  /** Icon-only rail when true; icon + label when false. */
  collapsed: boolean;
  /** Called after a link is tapped — lets the mobile drawer close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) =>
        item.children && item.children.length > 0 && !collapsed ? (
          <NavGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        )
      )}
    </ul>
  );
}

/** A single navigation link (top-level or nested). */
function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  const badge = badgeLabel(item.badge);
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  const dropTarget = item.classSectionId;

  function onDrop(e: React.DragEvent) {
    if (!dropTarget) return;
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: { type: "teacher" | "student"; id: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    startTransition(async () => {
      try {
        if (payload.type === "teacher") {
          await copyTeacherToClass(payload.id, dropTarget);
          toast.success("Teacher also assigned to that class");
        } else {
          await moveStudentToClass(payload.id, dropTarget);
          toast.success("Student moved to that class");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't complete the move");
      }
    });
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onDragOver={
        dropTarget
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={dropTarget ? () => setDragOver(false) : undefined}
      onDrop={dropTarget ? onDrop : undefined}
      className={`group flex items-center rounded-sm font-medium transition ${
        nested ? "text-[0.9rem]" : "text-[0.95rem]"
      } ${collapsed ? "justify-center px-2.5 py-2.5" : "gap-3 px-3 py-2.5"} ${
        dragOver
          ? "bg-rust/15 text-maroon ring-2 ring-rust"
          : active
            ? "bg-maroon text-cream shadow-sm dark:ring-1 dark:ring-[color:var(--color-hairline)]"
            : "text-slate-strong hover:bg-mist"
      }`}
    >
      <span className="relative shrink-0">
        <Icon className={nested ? "h-4 w-4" : "h-5 w-5"} />
        {badge && collapsed && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.6rem] font-bold leading-none text-white"
            aria-label={`${badge} new`}
          >
            {badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {badge && !collapsed && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

/** A top-level item with a collapsible list of children. The row itself links to
 * the parent hub; a chevron toggles the nested list without navigating. */
function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const parentActive = isActive(item, pathname);
  const childActive = (item.children ?? []).some((c) => isActive(c, pathname));
  // Default open when the section is active; a manual toggle takes over from there.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? (parentActive || childActive);

  const Icon = item.icon;

  return (
    <li>
      <div
        className={`group flex items-center rounded-sm text-[0.95rem] font-medium transition ${
          parentActive
            ? "bg-maroon text-cream shadow-sm dark:ring-1 dark:ring-[color:var(--color-hairline)]"
            : "text-slate-strong hover:bg-mist"
        }`}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={parentActive ? "page" : undefined}
          className="flex flex-1 items-center gap-3 rounded-sm px-3 py-2.5"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setUserOpen(!open)}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={open}
          className={`mr-1 rounded-sm p-1.5 transition ${
            parentActive ? "text-cream/80 hover:text-cream" : "text-slate hover:text-maroon"
          }`}
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
      </div>

      {open && (
        <ul className="mt-1 flex flex-col gap-1 border-l border-hairline pl-3 ml-4">
          {(item.children ?? []).map((child) => (
            <li key={child.href}>
              <NavLink item={child} pathname={pathname} collapsed={false} onNavigate={onNavigate} nested />
            </li>
          ))}
          {item.children?.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-slate">None yet</li>
          )}
        </ul>
      )}
    </li>
  );
}
