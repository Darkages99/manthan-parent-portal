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

const PRINCIPAL_ROLES: Tables<"staff">["role"][] = ["principal", "super_admin"];

function buildNavItems(role: Tables<"staff">["role"], ptmMeetings: PtmNavMeeting[]): NavItem[] {
  const isPrincipal = PRINCIPAL_ROLES.includes(role);
  return [
    { href: "/console", label: "Dashboard", icon: HomeIcon, exact: true },
    { href: "/console/messages", label: "Messages", icon: MailIcon },
    { href: "/console/attendance", label: "Attendance", icon: CheckCircleIcon },
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
          { href: "/console/classes", label: "Classes", icon: ClassIcon },
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
  children,
}: {
  staffName: string;
  /** Staff member's role — gates the principal-only nav sections. */
  role: Tables<"staff">["role"];
  /** PTM meetings shown as collapsible sub-items under the PTMs nav entry. */
  ptmMeetings?: PtmNavMeeting[];
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={buildNavItems(role, ptmMeetings)} subtitle="Staff console" accountName={staffName}>
      {children}
    </AppShell>
  );
}
