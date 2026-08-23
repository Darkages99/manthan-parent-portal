"use client";

import { useState, useTransition } from "react";
import { toggleSubmission } from "@/app/(staff)/console/homework/actions";
import { useToast } from "./toast-provider";

type Student = { id: string; first_name: string; last_name: string };

/** Per-student submitted/not-submitted checklist for one homework
 * assignment. Default checked = submitted (no row in homework_submissions);
 * unchecking marks not submitted, which the daily cron notifies guardians
 * about once the due date has passed. */
export function HomeworkSubmissionList({
  homeworkId,
  students,
  notSubmittedIds,
}: {
  homeworkId: string;
  students: Student[];
  notSubmittedIds: string[];
}) {
  const toast = useToast();
  const [notSubmitted, setNotSubmitted] = useState(new Set(notSubmittedIds));
  const [, startTransition] = useTransition();

  function toggle(studentId: string) {
    const willBeSubmitted = notSubmitted.has(studentId);
    setNotSubmitted((prev) => {
      const next = new Set(prev);
      if (willBeSubmitted) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
    startTransition(async () => {
      try {
        await toggleSubmission(homeworkId, studentId, willBeSubmitted);
        toast.success(willBeSubmitted ? "Marked submitted" : "Marked not submitted");
      } catch {
        setNotSubmitted((prev) => {
          const next = new Set(prev);
          if (willBeSubmitted) next.add(studentId);
          else next.delete(studentId);
          return next;
        });
      }
    });
  }

  return (
    <ul className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
      {students.length === 0 && <li className="px-5 py-4 text-base text-slate">No students in this class.</li>}
      {students.map((s) => {
        const submitted = !notSubmitted.has(s.id);
        return (
          <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-base text-slate-strong">
              {s.first_name} {s.last_name}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={submitted} onChange={() => toggle(s.id)} />
              <span className={submitted ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}>
                {submitted ? "Submitted" : "Not submitted"}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
