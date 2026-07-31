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
} from "./icons";

const navItems: NavItem[] = [
  { href: "/console", label: "Dashboard", icon: HomeIcon, exact: true },
  { href: "/console/attendance", label: "Attendance", icon: CheckCircleIcon },
  { href: "/console/qr-codes", label: "QR codes", icon: QrCodeIcon },
  { href: "/console/leave", label: "Leave", icon: LeaveIcon },
  { href: "/console/stay-back", label: "Stay-back approvals", icon: ConsentIcon },
  { href: "/console/ptm", label: "PTM slots", icon: UsersIcon },
  { href: "/console/defaulters", label: "Defaulters", icon: AlertTriangleIcon },
  { href: "/console/messages/compose", label: "Compose message", icon: MailIcon },
];

export function StaffShell({
  staffName,
  children,
}: {
  staffName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={navItems} subtitle="Staff console" accountName={staffName}>
      {children}
    </AppShell>
  );
}
