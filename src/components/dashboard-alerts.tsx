"use client";

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  readReportCardSeen,
  type DashboardAlertData,
  type StudentAlertState,
} from "@/lib/alerts";
import {
  PaymentIcon,
  UsersIcon,
  AwardIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from "./icons";

type Alert = {
  key: string;
  icon: (props: { className?: string }) => React.ReactNode;
  title: string;
  detail: string;
  href: string;
  /** Tailwind classes for the icon chip tint. */
  tint: string;
};

const EMPTY_SEEN: Record<string, string> = {};

/** Reads report-card acknowledgements from localStorage without a hydration
 *  mismatch: SSR + first client render see `{}`, then React swaps in the real
 *  values. `useSyncExternalStore` also picks up cross-tab `storage` events. */
function useReportCardSeen(students: StudentAlertState[]): Record<string, string> {
  const cache = useRef<{ sig: string; map: Record<string, string> }>({ sig: "", map: EMPTY_SEEN });
  const ids = students.map((s) => s.id);

  const getSnapshot = () => {
    let sig = "";
    const map: Record<string, string> = {};
    for (const id of ids) {
      const v = readReportCardSeen(id);
      if (v) {
        map[id] = v;
        sig += `${id}=${v};`;
      }
    }
    // Return a stable reference while the stored values are unchanged.
    if (cache.current.sig !== sig) cache.current = { sig, map };
    return cache.current.map;
  };

  return useSyncExternalStore(subscribeToStorage, getSnapshot, () => EMPTY_SEEN);
}

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function DashboardAlerts({ data }: { data: DashboardAlertData }) {
  const seen = useReportCardSeen(data.students);

  const alerts: Alert[] = [];

  // Fees — placeholder until the payments backend exists (see lib/alerts.ts).
  if (data.feeDue) {
    alerts.push({
      key: "fee",
      icon: PaymentIcon,
      title: "Pay pending fees",
      detail: "Fees are due for this term. Tap to view the schedule and pay.",
      href: "/payments",
      tint: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    });
  }

  // PTM — one per child who still needs to book an open slot.
  for (const s of data.students) {
    if (s.ptmNeedsBooking) {
      alerts.push({
        key: `ptm-${s.id}`,
        icon: UsersIcon,
        title: `Book a PTM slot for ${s.name}`,
        detail: "A parent–teacher meeting slot is open for this class.",
        href: "/ptm",
        tint: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
      });
    }
  }

  // Report cards — one per child with a published card not yet opened.
  for (const s of data.students) {
    if (s.reportCardAvailable && seen[s.id] !== s.reportCardSignature) {
      alerts.push({
        key: `rc-${s.id}`,
        icon: AwardIcon,
        title: `Check ${s.name}'s report card`,
        detail: "A new report card has been published. Tap to review it.",
        href: "/results",
        tint: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      });
    }
  }

  return (
    <div className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Alerts</h2>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
          <p className="text-base font-medium text-slate-strong">You&apos;re all caught up</p>
          <p className="text-sm text-slate">No pending actions right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-sm border border-hairline bg-mist/40 p-3 transition hover:border-rust/50 hover:bg-mist"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.tint}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-maroon">{a.title}</p>
                    <p className="truncate text-sm text-slate-strong">{a.detail}</p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate transition group-hover:text-rust" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
