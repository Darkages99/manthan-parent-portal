"use client";

import { useEffect, useMemo, useState } from "react";
import { reportCardSignature, writeReportCardSeen } from "@/lib/alerts";
import { useSelectedChild } from "@/lib/selected-child-context";
import { Button } from "./button";
import { ProgressRing } from "./charts";
import { DownloadIcon } from "./icons";
import type { Tables } from "@/lib/supabase/database.types";

type Student = Tables<"students">;
type Result = Tables<"exam_results">;

export function ResultsView({
  students,
  resultsByStudent,
}: {
  students: Student[];
  resultsByStudent: Record<string, Result[]>;
}) {
  const { selectedChildId } = useSelectedChild();
  const activeId = selectedChildId ?? students[0]?.id;
  const results = resultsByStudent[activeId] ?? [];

  // Opening Results acknowledges every published report card, clearing the
  // dashboard alert for each child (per-device, via localStorage).
  useEffect(() => {
    for (const [studentId, rows] of Object.entries(resultsByStudent)) {
      const signature = reportCardSignature(rows.map((r) => r.report_card_pdf_url));
      if (signature) writeReportCardSeen(studentId, signature);
    }
  }, [resultsByStudent]);

  const terms = useMemo(
    () => Array.from(new Set(results.map((r) => r.term))).sort().reverse(),
    [results]
  );
  const [term, setTerm] = useState<string | undefined>(terms[0]);
  const activeTerm = term && terms.includes(term) ? term : terms[0];

  const rows = results.filter((r) => r.term === activeTerm);
  const obtained = rows.reduce((sum, r) => sum + Number(r.marks), 0);
  const max = rows.reduce((sum, r) => sum + Number(r.max_marks), 0);
  const pct = max ? Math.round((obtained / max) * 1000) / 10 : 0;

  const hasReportCard = rows.some((r) => r.report_card_pdf_url);

  return (
    <div className="flex flex-col gap-6">
      {terms.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTerm(t)}
              className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
                t === activeTerm
                  ? "bg-rust text-white"
                  : "border border-hairline bg-mist text-slate-strong hover:bg-parchment"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-base text-slate">No results published yet.</p>
      ) : (
        <>
        <div className="flex items-center gap-6 rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
          <ProgressRing value={pct} size={104} thickness={10} label={activeTerm} />
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-wide text-slate">Overall this term</p>
            <p className="mt-1 font-heading text-3xl text-maroon tabular-nums">
              {obtained}
              <span className="text-slate"> / {max}</span>
            </p>
            <p className="mt-1 text-sm text-slate-strong">
              {rows.length} {rows.length === 1 ? "subject" : "subjects"} · {activeTerm}
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
          <table className="w-full text-left">
            <thead className="bg-maroon text-cream">
              <tr>
                <th className="px-5 py-3 font-heading text-base font-normal">Subject</th>
                <th className="px-5 py-3 text-right font-heading text-base font-normal">Marks</th>
                <th className="px-5 py-3 text-right font-heading text-base font-normal">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-base text-slate-strong">{r.subject}</td>
                  <td className="px-5 py-3 text-right text-base tabular-nums text-slate-strong">
                    {Number(r.marks)} <span className="text-slate">/ {Number(r.max_marks)}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-base font-semibold text-maroon">{r.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-hairline bg-mist">
                <td className="px-5 py-3 font-semibold text-maroon">Total · {activeTerm}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-maroon">
                  {obtained} / {max}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-maroon">{pct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      <div>
        <Button
          variant="secondary"
          disabled={!hasReportCard}
          icon={<DownloadIcon className="h-4 w-4" />}
          className="px-4 py-2.5"
          title={hasReportCard ? "Download report card" : "Report card PDF not published yet"}
        >
          Download report card (PDF)
        </Button>
        {!hasReportCard && (
          <p className="mt-2 text-sm text-slate">
            The signed report card PDF is generated by the school and served from secure storage —
            it appears here once published.
          </p>
        )}
      </div>
    </div>
  );
}
