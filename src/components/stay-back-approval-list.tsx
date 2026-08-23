"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { StatusPill } from "@/components/status-pill";
import { ApprovalChain } from "@/components/approval-chain";
import { decideStayBack, remindStayBackApprovers } from "@/app/(staff)/console/stay-back/actions";
import { useToast } from "@/components/toast-provider";
import { resolveApproverMatch } from "@/lib/approval-match";
import { buildWhatsAppLink } from "@/lib/notifications/whatsapp";
import { formatTime } from "@/lib/format";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { BellIcon } from "@/components/icons";
import type { Tables } from "@/lib/supabase/database.types";

type Consent = Tables<"stay_back_consents">;

export function StayBackApprovalList({
  consents,
  students,
  teachers,
  guardianPhones,
  staffNames,
  viewer,
  stepsByConsent,
}: {
  consents: Consent[];
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  guardianPhones: Record<string, string>;
  /** staff id → display name, for showing who acted on / owns each step. */
  staffNames: Record<string, string>;
  viewer: Tables<"staff">;
  stepsByConsent: Record<string, Tables<"approval_steps">[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

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

        const steps = stepsByConsent[c.id] ?? [];
        const match = resolveApproverMatch(viewer.role, viewer.id, c.teacher_id);
        let myStep = match
          ? steps.find(
              (s) =>
                s.approver_role === match.approverRole &&
                (!match.matchByStaffId || c.teacher_id === viewer.id),
            )
          : undefined;
        // Coordinator is admin-equivalent: grade 8+ chains have no dedicated
        // coordinator step, so fall back to the principal step.
        if (!myStep && viewer.role === "coordinator") {
          myStep = steps.find((s) => s.approver_role === "principal");
        }
        const canDecide = c.status === "pending" && !!myStep && myStep.decision === null;

        return (
          <motion.li
            key={c.id}
            variants={fadeUp}
            className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-maroon">
                  {student?.first_name} {student?.last_name}
                  <span className="font-normal text-slate-strong"> — {c.reason}</span>
                </p>
                <p className="mt-1 text-sm text-slate-strong">
                  {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)} · Named teacher:{" "}
                  {teacher?.name}
                </p>
              </div>
              <StatusPill status={c.status} />
            </div>

            <div className="mt-4 border-t border-hairline bg-mist/40 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <ApprovalChain steps={steps} staffNames={staffNames} highlightStepId={myStep?.id} />
                {c.status === "pending" && steps.some((s) => s.decision === null) && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await remindStayBackApprovers(c.id);
                          toast.success("Reminder sent to pending approvers");
                        } catch (err) {
                          toast.error((err as Error).message || "Couldn't send reminder");
                        }
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                  >
                    <BellIcon className="h-4 w-4" />
                    Remind pending
                  </motion.button>
                )}
              </div>
            </div>

            {canDecide ? (
              <div className="flex flex-wrap gap-2 px-5 pb-5 pt-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await decideStayBack(c.id, "approved");
                        toast.success("Approved");
                      } catch (err) {
                        toast.error((err as Error).message || "Couldn't approve");
                      }
                    })
                  }
                  className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                >
                  Approve
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await decideStayBack(c.id, "declined");
                        toast.success("Declined");
                      } catch (err) {
                        toast.error((err as Error).message || "Couldn't decline");
                      }
                    })
                  }
                  className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                >
                  Decline
                </motion.button>
              </div>
            ) : (
              c.status !== "pending" &&
              parentPhone && (
                <div className="px-5 pb-5 pt-4">
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
