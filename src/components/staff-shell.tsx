"use client";

import { AppShell } from "./app-shell";
import { type NavItem } from "./sidebar-nav";
import {
  HomeIcon,
  CheckCircleIcon,
  LeaveIcon,
  ConsentIcon,
  UsersIcon,
  AlertTriangleIcon,
  MailIcon,
  QrCodeIcon,
  CalendarIcon,
} from "./icons";

export type PtmNavMeeting = { id: string; label: string };

function buildNavItems(ptmMeetings: PtmNavMeeting[]): NavItem[] {
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
    { href: "/console/qr-codes", label: "QR codes", icon: QrCodeIcon },
    { href: "/console/defaulters", label: "Defaulters", icon: AlertTriangleIcon },
  ];
}

export function StaffShell({
  staffName,
  ptmMeetings = [],
  children,
}: {
  staffName: string;
  /** PTM meetings shown as collapsible sub-items under the PTMs nav entry. */
  ptmMeetings?: PtmNavMeeting[];
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={buildNavItems(ptmMeetings)} subtitle="Staff console" accountName={staffName}>
      {children}
    </AppShell>
  );
}
