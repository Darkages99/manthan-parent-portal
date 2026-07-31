"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
  /** Match only the exact href, not descendant routes. Needed for index links
   *  whose href is a prefix of every sibling (e.g. the staff `/console` dashboard). */
  exact?: boolean;
};

/** Vertical, icon-led navigation for the parent portal sidebar. */
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
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center rounded-sm text-[0.95rem] font-medium transition ${
                collapsed ? "justify-center px-2.5 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-maroon text-cream shadow-sm dark:ring-1 dark:ring-[color:var(--color-hairline)]"
                  : "text-slate-strong hover:bg-mist"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
