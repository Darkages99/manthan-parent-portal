"use client";

import { AppShell } from "./app-shell";
import { type NavItem } from "./sidebar-nav";
import {
  HomeIcon,
  CheckCircleIcon,
  LeaveIcon,
  ConsentIcon,
  UsersIcon,
  AwardIcon,
  AlertTriangleIcon,
  ClassIcon,
  GridIcon,
  ImageIcon,
  MailIcon,
  QrCodeIcon,
  CalendarIcon,
  FlagIcon,
  RefreshIcon,
} from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

export type PtmNavMeeting = { id: string; label: string };
export type ClassNavItem = { id: string; label: string };

const PRINCIPAL_ROLES: Tables<"staff">["role"][] = ["principal", "super_admin", "coordinator"];

function buildNavItems(
  role: Tables<"staff">["role"],
  ptmMeetings: PtmNavMeeting[],
  attendanceReminder: boolean,
  classes: ClassNavItem[]
): NavItem[] {
  const isPrincipal = PRINCIPAL_ROLES.includes(role);
  return [
    { href: "/console", label: "Dashboard", icon: HomeIcon, exact: true },
    { href: "/console/messages", label: "Messages", icon: MailIcon },
    {
      href: "/console/attendance",
      label: "Attendance",
      icon: CheckCircleIcon,
      badge: attendanceReminder ? 1 : undefined,
    },
    { href: "/console/leave", label: "Leave", icon: LeaveIcon },
    { href: "/console/stay-back", label: "Stay-back approvals", icon: ConsentIcon },
    {
      href: "/console/ptm",
      label: "PTMs",
      icon: UsersIcon,
      exact: true,
      children: ptmMeetings.map((m) => ({
        href: `/console/ptm/${m.id}`,
        label: m.label,
        icon: CalendarIcon,
      })),
    },
    { href: "/console/timetable", label: "Timetable", icon: GridIcon },
    { href: "/console/homework", label: "Homework", icon: ClassIcon },
    // Principal-only administration.
    ...(isPrincipal
      ? [
          {
            href: "/console/classes",
            label: "Classes",
            icon: ClassIcon,
            exact: true,
            children: classes.map((c) => ({
              href: `/console/classes/${c.id}`,
              label: c.label,
              icon: ClassIcon,
            })),
          },
          { href: "/console/staff", label: "Staff", icon: UsersIcon },
          { href: "/console/results", label: "Results", icon: AwardIcon },
          { href: "/console/competitions", label: "Competitions", icon: AwardIcon },
        ]
      : []),
    { href: "/console/qr-codes", label: "QR codes", icon: QrCodeIcon },
    { href: "/console/defaulters", label: "Defaulters", icon: AlertTriangleIcon },
    { href: "/console/issues", label: "Reported issues", icon: FlagIcon },
    ...(isPrincipal
      ? [
          { href: "/console/gallery", label: "Gallery", icon: ImageIcon },
          { href: "/console/sync", label: "Sheet sync", icon: RefreshIcon },
        ]
      : []),
  ];
}

export function StaffShell({
  staffName,
  role,
  ptmMeetings = [],
  attendanceReminder = false,
  classes = [],
  children,
}: {
  staffName: string;
  /** Staff member's role — gates the principal-only nav sections. */
  role: Tables<"staff">["role"];
  /** PTM meetings shown as collapsible sub-items under the PTMs nav entry. */
  ptmMeetings?: PtmNavMeeting[];
  /** When true, shows a "mark attendance" nudge banner and nav badge. */
  attendanceReminder?: boolean;
  /** Classes shown as collapsible sub-items under the Classes nav entry (principal-only). */
  classes?: ClassNavItem[];
  children: React.ReactNode;
}) {
  return (
    <AppShell
      navItems={buildNavItems(role, ptmMeetings, attendanceReminder, classes)}
      subtitle="Staff console"
      accountName={staffName}
      banner={
        attendanceReminder ? (
          <a
            href="/console/attendance"
            className="mb-5 flex items-center gap-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900 shadow-[var(--shadow-card)] transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            Mark attendance for today →
          </a>
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
