"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getStudentQr,
  issueStudentQr,
  regenerateStudentQr,
  issueMissingQrCodes,
  type StudentQr,
} from "@/app/(staff)/console/qr-codes/actions";
import { EASE_OUT_EXPO } from "@/lib/motion";
import type { Tables } from "@/lib/supabase/database.types";

type ClassSection = Tables<"class_sections">;
type Student = Tables<"students">;

export function QrManager({
  classes,
  studentsByClass,
  issuedStudentIds,
  canManage,
}: {
  classes: ClassSection[];
  studentsByClass: Record<string, Student[]>;
  issuedStudentIds: string[];
  canManage: boolean;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qr, setQr] = useState<StudentQr | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "none">("idle");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Set<string>>(() => new Set(issuedStudentIds));
  const [isPending, startTransition] = useTransition();

  const allStudents = useMemo(
    () => Object.values(studentsByClass).flat(),
    [studentsByClass]
  );
  const classById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes]
  );

  const students = useMemo(
    () => studentsByClass[classId] ?? [],
    [studentsByClass, classId]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.roll_no}`.toLowerCase().includes(q)
    );
  }, [students, query]);

  const selected = selectedId ? allStudents.find((s) => s.id === selectedId) ?? null : null;
  const missingCount = allStudents.filter((s) => !issued.has(s.id)).length;

  function classLabel(student: Student) {
    const c = classById[student.class_section_id];
    return c ? `Grade ${c.grade} - ${c.section}` : "";
  }

  function selectStudent(student: Student) {
    setSelectedId(student.id);
    setError(null);
    setQr(null);
    setLoadState("loading");
    startTransition(async () => {
      try {
        const result = await getStudentQr(student.id);
        setQr(result);
        setLoadState(result ? "loaded" : "none");
      } catch (e) {
        setError((e as Error).message);
        setLoadState("idle");
      }
    });
  }

  function generate() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await issueStudentQr(selected.id);
        setQr(result);
        setLoadState("loaded");
        setIssued((prev) => new Set(prev).add(selected.id));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function regenerate() {
    if (!selected) return;
    const ok = window.confirm(
      `Regenerate the QR code for ${selected.first_name} ${selected.last_name}? Any card or badge already printed with the old code will stop working.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateStudentQr(selected.id);
        setQr(result);
        setLoadState("loaded");
        setIssued((prev) => new Set(prev).add(selected.id));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function generateAllMissing() {
    if (missingCount === 0) return;
    const ok = window.confirm(`Generate QR codes for ${missingCount} student(s) who don't have one yet?`);
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await issueMissingQrCodes();
        setIssued(new Set(allStudents.map((s) => s.id)));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function printQr() {
    if (!qr || !selected) return;
    const name = `${selected.first_name} ${selected.last_name}`;
    const w = window.open("", "_blank", "width=460,height=620");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>QR — ${name}</title><style>` +
        `body{font-family:system-ui,sans-serif;text-align:center;padding:32px;margin:0}` +
        `.card{display:inline-block;border:1px solid #ddd;border-radius:8px;padding:24px}` +
        `svg{width:300px;height:300px}h1{font-size:20px;margin:0 0 2px}` +
        `p{color:#555;margin:2px 0;font-size:14px}code{font-size:10px;color:#999;word-break:break-all}` +
        `</style></head><body><div class="card"><h1>${name}</h1>` +
        `<p>${classLabel(selected)} · Roll ${selected.roll_no}</p>${qr.svg}` +
        `<p><code>${qr.token}</code></p></div>` +
        `<script>window.onload=function(){window.print()}<\/script></body></html>`
    );
    w.document.close();
  }

  function downloadSvg() {
    if (!qr || !selected) return;
    const blob = new Blob([qr.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${selected.roll_no}-${selected.first_name}-${selected.last_name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Roster / picker */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {classes.length > 1 && (
            <label className="flex flex-col gap-1.5 text-base">
              <span className="font-medium text-maroon">Class</span>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setQuery("");
                }}
                className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Grade {c.grade} - {c.section}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-1 flex-col gap-1.5 text-base">
            <span className="font-medium text-maroon">Find a student</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or roll number"
              className="rounded-sm border border-hairline bg-mist px-3 py-2.5 text-base"
            />
          </label>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={generateAllMissing}
            disabled={isPending || missingCount === 0}
            className="self-start rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon transition hover:border-rust/60 disabled:opacity-50"
          >
            {missingCount === 0
              ? "Every student has a code"
              : `Generate for ${missingCount} without a code`}
          </button>
        )}

        <ul className="max-h-[28rem] divide-y divide-hairline overflow-y-auto rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]">
          {filtered.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => selectStudent(s)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${
                    active ? "bg-rust-tint/40" : "hover:bg-mist"
                  }`}
                >
                  <span className="text-base text-slate-strong">
                    {s.first_name} {s.last_name}
                    <span className="ml-2 text-sm text-slate">Roll {s.roll_no}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      issued.has(s.id)
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-mist text-slate"
                    }`}
                  >
                    {issued.has(s.id) ? "QR ready" : "No code"}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-5 py-4 text-base text-slate">No students match.</li>
          )}
        </ul>
      </div>

      {/* Detail / QR panel */}
      <div className="rounded-sm border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        {!selected ? (
          <p className="text-base text-slate">Select a student to view or generate their QR code.</p>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="font-heading text-2xl text-maroon">
                {selected.first_name} {selected.last_name}
              </h2>
              <p className="mt-1 text-base text-slate-strong">
                {classLabel(selected)} · Roll {selected.roll_no}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {loadState === "loading" && (
                <motion.p
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-10 text-base text-slate"
                >
                  Loading…
                </motion.p>
              )}

              {loadState === "none" && (
                <motion.div
                  key="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-6"
                >
                  <p className="text-base text-slate">No QR code has been generated yet.</p>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={generate}
                      disabled={isPending}
                      className="rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream transition hover:bg-maroon-strong disabled:opacity-60"
                    >
                      {isPending ? "Generating…" : "Generate QR code"}
                    </button>
                  ) : (
                    <p className="text-sm text-slate">Ask the principal to generate one.</p>
                  )}
                </motion.div>
              )}

              {loadState === "loaded" && qr && (
                <motion.div
                  key={`loaded-${qr.token}`}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                  variants={{
                    hidden: { opacity: 0, scaleY: 0.85, clipPath: "inset(0% 45% 0% 45%)" },
                    show: {
                      opacity: 1,
                      scaleY: 1,
                      clipPath: "inset(0% 0% 0% 0%)",
                      transition: { duration: 0.55, ease: EASE_OUT_EXPO },
                    },
                  }}
                  style={{ transformOrigin: "top center" }}
                  className="flex flex-col items-center gap-4"
                >
                  <div
                    className="w-64 max-w-full rounded-sm border border-hairline bg-white p-4 [&_svg]:h-full [&_svg]:w-full"
                    // The SVG is generated server-side by the `qrcode` library from a
                    // random token — no user-controlled markup is injected here.
                    dangerouslySetInnerHTML={{ __html: qr.svg }}
                  />
                  <p className="break-all font-mono text-xs text-slate">{qr.token}</p>
                  <p className="text-sm text-slate">
                    Issued {new Date(qr.issuedAt).toLocaleDateString()}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={printQr}
                      className="rounded-sm bg-maroon px-4 py-2 text-sm font-semibold text-cream transition hover:bg-maroon-strong"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={downloadSvg}
                      className="rounded-sm border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-maroon transition hover:border-rust/60"
                    >
                      Download SVG
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={regenerate}
                        disabled={isPending}
                        className="rounded-sm border border-rust/40 bg-rust-tint/30 px-4 py-2 text-sm font-semibold text-rust transition hover:border-rust/70 disabled:opacity-60"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <p className="text-base text-rose-700">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
