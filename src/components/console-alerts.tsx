"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { formatDayDate } from "@/lib/format";
import { ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LeaveIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "./icons";
import type { ConsoleAlertData } from "@/lib/console-alerts";

const MAX_LOW_ATTENDANCE = 4;

export function ConsoleAlerts({ data }: { data: ConsoleAlertData }) {
  const { lowAttendance, dayAbsences, uninformedToday } = data;
  const total = lowAttendance.length + dayAbsences.length + (uninformedToday.length > 0 ? 1 : 0);
  const shownLow = lowAttendance.slice(0, MAX_LOW_ATTENDANCE);
  const extraLow = lowAttendance.length - shownLow.length;

  return (
    <div className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-xl text-maroon">Alerts</h2>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
          <p className="text-base font-medium text-slate-strong">Nothing needs attention</p>
          <p className="text-sm text-slate">No low attendance, absences, or missed check-ins.</p>
        </div>
      ) : (
        <motion.ul
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2"
        >
          {/* Uninformed absences — a single grouped alert linking to analytics. */}
          {uninformedToday.length > 0 && (
            <motion.li variants={fadeUp}>
              <Link
                href="/console/attendance"
                className="group flex items-center gap-3 rounded-sm border border-rose-300 bg-rose-50/70 p-3 transition hover:border-rose-400 dark:border-rose-500/50 dark:bg-rose-900/20"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                  <AlertTriangleIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-maroon">
                    {uninformedToday.length} uninformed{" "}
                    {uninformedToday.length === 1 ? "absence" : "absences"} today
                  </p>
                  <p className="truncate text-sm text-slate-strong">
                    {uninformedToday.map((u) => u.name).join(", ")} — marked absent with no approved leave.
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate transition group-hover:text-rust" />
              </Link>
            </motion.li>
          )}

          {/* Approved absences — one expandable alert per day. */}
          {dayAbsences.map((day) => (
            <DayAbsenceAlert key={day.date} date={day.date} students={day.students} />
          ))}

          {/* Low attendance — one alert per student, capped. */}
          {shownLow.map((s) => (
            <motion.li key={s.id} variants={fadeUp}>
              <Link
                href="/console/attendance"
                className="group flex items-center gap-3 rounded-sm border border-hairline bg-mist/40 p-3 transition hover:border-rust/50 hover:bg-mist"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                  <AlertTriangleIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-maroon">
                    {s.name} is below {ATTENDANCE_THRESHOLD}% attendance
                  </p>
                  <p className="truncate text-sm text-slate-strong">
                    {s.className} · currently {s.pct}% present.
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate transition group-hover:text-rust" />
              </Link>
            </motion.li>
          ))}

          {extraLow > 0 && (
            <motion.li variants={fadeUp}>
              <Link
                href="/console/attendance"
                className="block rounded-sm px-3 py-2 text-sm font-medium text-rust hover:underline"
              >
                +{extraLow} more below {ATTENDANCE_THRESHOLD}% → Attendance
              </Link>
            </motion.li>
          )}
        </motion.ul>
      )}
    </div>
  );
}

/** One day's approved absences, expandable to reveal each child + reason. */
function DayAbsenceAlert({
  date,
  students,
}: {
  date: string;
  students: { name: string; reason: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.li variants={fadeUp}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-sm border border-hairline bg-mist/40 p-3 text-left transition hover:border-rust/50 hover:bg-mist"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
          <LeaveIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-maroon">
            {students.length} {students.length === 1 ? "student" : "students"} absent on{" "}
            {formatDayDate(date)}
          </p>
          <p className="truncate text-sm text-slate-strong">
            {students.map((s) => s.name).join(", ")}
          </p>
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
