"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { StatusPill } from "@/components/status-pill";
import { decideStayBack } from "@/app/(staff)/console/stay-back/actions";
import { buildWhatsAppLink } from "@/lib/notifications/whatsapp";
import { formatTime } from "@/lib/format";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { Tables } from "@/lib/supabase/database.types";

type Consent = Tables<"stay_back_consents">;

export function StayBackApprovalList({
  consents,
  students,
  teachers,
  guardianPhones,
  viewer,
}: {
  consents: Consent[];
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  guardianPhones: Record<string, string>;
  viewer: Tables<"staff">;
}) {
  const [isPending, startTransition] = useTransition();
  const isPrincipal = viewer.role === "principal" || viewer.role === "super_admin";

  return (
    <motion.ul
      variants={staggerContainer()}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
    >
      {consents.map((c) => {
        const student = students.find((s) => s.id === c.student_id);
        const teacher = teachers.find((t) => t.id === c.teacher_id);
        const parentPhone = guardianPhones[c.raised_by_guardian_id];
        const nudgeMessage = `Manthan Vidyashram: your stay-back request for ${student?.first_name} on ${c.stay_date} (${formatTime(c.from_time)}-${formatTime(c.to_time)}) is ${c.status}.`;

        const isNamedTeacher = c.teacher_id === viewer.id;
        const canDecide = c.status === "pending" && ((isNamedTeacher && !c.teacher_decision) || (isPrincipal && !c.principal_decision));
        const awaiting =
          c.status === "pending" &&
          ((c.teacher_decision === "approved" && !c.principal_decision && "Awaiting principal") ||
            (c.principal_decision === "approved" && !c.teacher_decision && "Awaiting teacher"));

        return (
          <motion.li
            key={c.id}
            variants={fadeUp}
            className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-maroon">
                  {student?.first_name} {student?.last_name} — {c.reason}
                </p>
                <p className="mt-1 text-base text-slate-strong">
                  {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)} · Named teacher:{" "}
                  {teacher?.name}
                </p>
                {awaiting && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{awaiting}</p>}
              </div>
              <StatusPill status={c.status} />
            </div>

            {canDecide ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                  onClick={() => startTransition(() => decideStayBack(c.id, "approved"))}
                  className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                >
                  Approve
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                  onClick={() => startTransition(() => decideStayBack(c.id, "declined"))}
                  className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                >
                  Decline
                </motion.button>
              </div>
            ) : (
              c.status !== "pending" &&
              parentPhone && (
                <div className="mt-4">
                  <a
                    href={buildWhatsAppLink(parentPhone, nudgeMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-mist px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment"
                  >
                    Notify parent on WhatsApp
                  </a>
                </div>
              )
            )}
          </motion.li>
        );
      })}
      {consents.length === 0 && <p className="text-base text-slate">No stay-back requests yet.</p>}
    </motion.ul>
  );
}
