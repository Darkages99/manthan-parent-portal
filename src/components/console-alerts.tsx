"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { resolveStaffAlert } from "@/app/(staff)/console/staff/actions";
import { useToast } from "./toast-provider";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  ConsentIcon,
  UsersIcon,
} from "./icons";
import type { ConsoleAlertData } from "@/lib/console-alerts";

export type StaffAlert = { id: string; message: string };

const MAX_NAMES_SHOWN = 3;

/** "A, B, C" for short lists; "A, B, C, etc." once it gets long — keeps the row from forcing the layout wide. */
function truncateList(items: string[], max = MAX_NAMES_SHOWN): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")}, etc.`;
}

/** How many alert rows the panel would render — shared with the dashboard page so it can decide layout. */
export function countAlerts(data: ConsoleAlertData, staffAlerts: StaffAlert[] = []): number {
  return (data.absentToday.length > 0 ? 1 : 0) + (data.stayingBackToday.length > 0 ? 1 : 0) + staffAlerts.length;
}

export function ConsoleAlerts({
  data,
  staffAlerts = [],
  fill = false,
}: {
  data: ConsoleAlertData;
  staffAlerts?: StaffAlert[];
  /** Stretch to fill the height its parent gives it and scroll internally, instead of sizing to content. Used when the dashboard pins this column's height to the calendar's. */
  fill?: boolean;
}) {
  const { absentToday, stayingBackToday } = data;
  const total = countAlerts(data, staffAlerts);

  return (
    <div
      className={`rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] ${
        fill ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
    >
      <h2 className="mb-4 font-heading text-xl text-maroon">Alerts</h2>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
          <p className="text-base font-medium text-slate-strong">Nothing needs attention</p>
          <p className="text-sm text-slate">No absences reported today.</p>
        </div>
      ) : (
        <motion.ul
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className={`flex flex-col gap-2 overflow-y-auto pr-1 ${fill ? "min-h-0 flex-1" : "max-h-[28rem]"}`}
        >
          {/* Staff deactivated while holding a class/subject assignment. */}
          {staffAlerts.map((a) => (
            <StaffAlertRow key={a.id} alert={a} />
          ))}

          {/* Everyone absent today — one expandable alert. */}
          {absentToday.length > 0 && <AbsentTodayAlert students={absentToday} />}

          {/* Everyone staying back today — links straight to the stay-back section. */}
          {stayingBackToday.length > 0 && (
            <motion.li variants={fadeUp}>
              <Link
                href="/console/stay-back"
                className="group flex items-center gap-3 rounded-sm border border-hairline bg-mist/40 p-3 transition hover:border-rust/50 hover:bg-mist"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                  <ConsentIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-maroon">
                    {stayingBackToday.length} {stayingBackToday.length === 1 ? "student" : "students"} staying
                    back today
                  </p>
                  <p className="text-sm text-slate-strong">
                    {truncateList(stayingBackToday.map((s) => s.name))}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate transition group-hover:text-rust" />
              </Link>
            </motion.li>
          )}
        </motion.ul>
      )}
    </div>
  );
}

/** A reassignment needed after a staff deactivation — dismissible once handled. */
function StaffAlertRow({ alert }: { alert: StaffAlert }) {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <motion.li variants={fadeUp}>
      <div className="flex items-center gap-3 rounded-sm border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/50 dark:bg-amber-900/20">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
          <UsersIcon className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-base font-semibold text-maroon">{alert.message}</p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await resolveStaffAlert(alert.id);
                setDismissed(true);
                toast.success("Dismissed");
              } catch {
                // Leave it visible — the click just didn't take.
              }
            })
          }
          aria-label="Dismiss"
          className="rounded-sm p-1.5 text-slate hover:text-rose-600 disabled:opacity-60"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </motion.li>
  );
}

/** Everyone absent today, expandable to reveal each child + reason. */
function AbsentTodayAlert({ students }: { students: { name: string; reason: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.li variants={fadeUp}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-sm border border-rose-300 bg-rose-50/70 p-3 text-left transition hover:border-rose-400 dark:border-rose-500/50 dark:bg-rose-900/20"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-maroon">
            {students.length} {students.length === 1 ? "student" : "students"} absent today
          </p>
          <p className="text-sm text-slate-strong">{truncateList(students.map((s) => s.name))}</p>
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-slate transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-12"
          >
            {students.map((s, i) => (
              <li key={`${s.name}-${i}`} className="border-b border-hairline py-2 last:border-0">
                <span className="text-sm font-semibold text-slate-strong">{s.name}</span>
                <span className="text-sm text-slate"> — {s.reason}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
