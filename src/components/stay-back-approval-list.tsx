"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { StatusPill } from "@/components/status-pill";
import { ApprovalChain } from "@/components/approval-chain";
import { Button } from "@/components/button";
import { Toolbar, SearchInput, SegmentedControl } from "@/components/filter-bar";
import { decideStayBack, remindStayBackApprovers } from "@/app/(staff)/console/stay-back/actions";
import { useToast } from "@/components/toast-provider";
import { resolveApproverMatch } from "@/lib/approval-match";
import { buildWhatsAppLink } from "@/lib/notifications/whatsapp";
import { formatTime } from "@/lib/format";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { BellIcon } from "@/components/icons";
import type { Tables } from "@/lib/supabase/database.types";

type StatusFilter = "all" | "pending" | "approved" | "declined";

type Consent = Tables<"stay_back_consents">;

export function StayBackApprovalList({
  consents,
  students,
  teachers,
  guardianPhones,
  guardianNames,
  staffNames,
  viewer,
  stepsByConsent,
}: {
  consents: Consent[];
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  guardianPhones: Record<string, string>;
  /** guardian id → display name, for the "raised by" search below. */
  guardianNames: Record<string, string>;
  /** staff id → display name, for showing who acted on / owns each step. */
  staffNames: Record<string, string>;
  viewer: Tables<"staff">;
  stepsByConsent: Record<string, Tables<"approval_steps">[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const toast = useToast();

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const counts = useMemo(() => {
    const c = { all: consents.length, pending: 0, approved: 0, declined: 0 };
    for (const x of consents) c[x.status as "pending" | "approved" | "declined"] += 1;
    return c;
  }, [consents]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = consents.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      const student = studentById.get(c.student_id);
      const haystack = [
        student?.first_name,
        student?.last_name,
        guardianNames[c.raised_by_guardian_id],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    // Pending requests need attention first; within each group, newest first.
    return [...filtered].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [consents, query, status, studentById, guardianNames]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search student or parent…"
          ariaLabel="Search stay-back requests"
        />
        <SegmentedControl<StatusFilter>
          ariaLabel="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "declined", label: "Declined", count: counts.declined },
          ]}
        />
      </Toolbar>

      <motion.ul
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-4"
      >
        {sorted.map((c) => {
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    loading={isPending}
                    icon={<BellIcon className="h-4 w-4" />}
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
                  >
                    Remind pending
                  </Button>
                )}
              </div>
            </div>

            {canDecide ? (
              <div className="flex flex-wrap gap-2 px-5 pb-5 pt-4">
                <Button
                  loading={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await decideStayBack(c.id, "approved");
                        toast.celebrate(`Approved · ${student?.first_name ?? "request"}`);
                      } catch (err) {
                        toast.error((err as Error).message || "Couldn't approve");
                      }
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  loading={isPending}
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
                >
                  Decline
                </Button>
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
        {sorted.length === 0 && (
          <p className="text-base text-slate">
            {consents.length === 0 ? "No stay-back requests yet." : "No requests match these filters."}
          </p>
        )}
      </motion.ul>
    </div>
  );
}
