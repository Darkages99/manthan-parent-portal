import { createClient } from "@/lib/supabase/server";
import { AwardIcon } from "@/components/icons";
import type { Tables } from "@/lib/supabase/database.types";

type Competition = Tables<"competitions">;

/** Soonest upcoming registration deadline first, falling back to the exam date when there's no deadline. */
function sortKey(c: Competition): string {
  return c.registration_deadline ?? c.exam_date ?? "9999-12-31";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CompetitionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("competitions").select("*");
  const competitions = [...(data ?? [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">External exams</p>
        <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Competitions &amp; Olympiads</h1>
        <p className="mt-2 max-w-prose text-lg text-slate-strong">
          Registration info and updates for external exams — NSO, IMO, IEO, Asset exams and more.
        </p>
      </div>

      {competitions.length === 0 ? (
        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 rounded-sm border border-dashed border-hairline bg-mist/40 px-6 py-10 text-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)]">
            <span className="absolute inset-0 rounded-full ring-1 ring-hairline" aria-hidden />
            <AwardIcon className="h-8 w-8 text-maroon/50" />
          </span>
          <div>
            <p className="font-heading text-xl text-maroon">Nothing listed yet</p>
            <p className="mx-auto mt-1.5 max-w-[22rem] text-base leading-relaxed text-slate">
              Check back later for registration info on olympiads and external exams.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {competitions.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-2">
                <AwardIcon className="h-5 w-5 shrink-0 text-rust" />
                <p className="font-heading text-xl text-maroon">{c.name}</p>
              </div>
              {c.description && <p className="text-base text-slate-strong">{c.description}</p>}
              <div className="mt-1 flex flex-col gap-1 text-sm text-slate">
                {c.registration_deadline && (
                  <span>
                    Registration by{" "}
                    <strong className="text-slate-strong">{formatDate(c.registration_deadline)}</strong>
                  </span>
                )}
                {c.exam_date && (
                  <span>
                    Exam on <strong className="text-slate-strong">{formatDate(c.exam_date)}</strong>
                  </span>
                )}
              </div>
              {c.external_link && (
                <a
                  href={c.external_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-rust underline decoration-rust/40 underline-offset-2 hover:decoration-rust"
                >
                  More info
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
