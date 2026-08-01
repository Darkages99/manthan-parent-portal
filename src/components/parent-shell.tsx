"use client";

import { AppShell } from "./app-shell";
import { type NavItem } from "./sidebar-nav";
import {
  HomeIcon,
  CheckCircleIcon,
  LeaveIcon,
  CalendarIcon,
  ConsentIcon,
  PaymentIcon,
  UsersIcon,
  AwardIcon,
  AlertTriangleIcon,
  ImageIcon,
  MailIcon,
} from "./icons";

function buildNavItems(unreadMessages: number): NavItem[] {
  return [
    { href: "/home", label: "Home", icon: HomeIcon },
    { href: "/messages", label: "Messages", icon: MailIcon, badge: unreadMessages },
    { href: "/attendance", label: "Attendance", icon: CheckCircleIcon },
    { href: "/leave", label: "Leave", icon: LeaveIcon },
    { href: "/dtr", label: "Dates to Remember", icon: CalendarIcon },
    { href: "/stay-back", label: "Stay-back consent", icon: ConsentIcon },
    { href: "/payments", label: "Payments", icon: PaymentIcon },
    { href: "/ptm", label: "PTM booking", icon: UsersIcon },
    { href: "/results", label: "Results", icon: AwardIcon },
    { href: "/defaulters", label: "Defaulters", icon: AlertTriangleIcon },
    { href: "/gallery", label: "Gallery", icon: ImageIcon },
  ];
}

export function ParentShell({
  guardianName,
  unreadMessages = 0,
  children,
}: {
  guardianName: string;
  /** Count of unread messages, shown as a red badge on the Messages nav item. */
  unreadMessages?: number;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      navItems={buildNavItems(unreadMessages)}
      subtitle="Parent Portal"
      accountName={guardianName}
      footer={
        <footer className="relative z-10 mt-auto border-t border-hairline bg-mist/80 px-4 py-6 text-center text-sm text-slate">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
            <span className="h-px w-8 bg-hairline" aria-hidden />
            Manthan Vidyashram Parent Portal
            <span className="h-px w-8 bg-hairline" aria-hidden />
          </div>
        </footer>
      }
    >
      {children}
    </AppShell>
  );
}
