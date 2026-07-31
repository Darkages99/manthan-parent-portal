"use client";

import { useTransition } from "react";
import { StatusPill } from "@/components/status-pill";
import { decideStayBack } from "@/app/(staff)/console/stay-back/actions";
import { buildWhatsAppLink } from "@/lib/notifications/whatsapp";
import { formatTime } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

type Consent = Tables<"stay_back_consents">;

export function StayBackApprovalList({
  consents,
  students,
  teachers,
  guardianPhones,
}: {
  consents: Consent[];
  students: Tables<"students">[];
  teachers: Tables<"staff">[];
  guardianPhones: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <ul className="flex flex-col gap-4">
      {consents.map((c) => {
        const student = students.find((s) => s.id === c.student_id);
        const teacher = teachers.find((t) => t.id === c.teacher_id);
        const parentPhone = guardianPhones[c.raised_by_guardian_id];
        const nudgeMessage = `Manthan Vidyashram: your stay-back request for ${student?.first_name} on ${c.stay_date} (${formatTime(c.from_time)}-${formatTime(c.to_time)}) is ${c.status}.`;

        return (
          <li key={c.id} className="rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-maroon">
                  {student?.first_name} {student?.last_name} — {c.reason}
                </p>
                <p className="mt-1 text-base text-slate-strong">
                  {c.stay_date} · {formatTime(c.from_time)}–{formatTime(c.to_time)} · Named teacher:{" "}
                  {teacher?.name}
                </p>
              </div>
              <StatusPill status={c.status} />
            </div>

            {c.status === "pending" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => decideStayBack(c.id, "approved"))}
                  className="rounded-sm bg-maroon px-4 py-2 text-base font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => decideStayBack(c.id, "declined"))}
                  className="rounded-sm border border-hairline bg-mist px-4 py-2 text-base font-semibold text-maroon hover:bg-parchment disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            ) : (
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
          </li>
        );
      })}
      {consents.length === 0 && <p className="text-base text-slate">No stay-back requests yet.</p>}
    </ul>
  );
}
