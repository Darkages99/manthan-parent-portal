import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/session";
import { isPrincipalRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ExpandableList } from "@/components/expandable-list";
import { formatDateTime } from "@/lib/format";
import type { Enums } from "@/lib/supabase/database.types";

const CATEGORIES: Enums<"notification_category">[] = [
  "stay_back",
  "leave",
  "ptm",
  "messages",
  "reminders",
  "defaulters",
  "consultations",
];

export default async function NotificationLogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.type !== "staff" || !isPrincipalRole(viewer.staff.role)) redirect("/console");

  const { category } = await searchParams;
  const activeCategory = CATEGORIES.includes(category as Enums<"notification_category">)
    ? (category as Enums<"notification_category">)
    : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("notification_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(500);
  if (activeCategory) query = query.eq("category", activeCategory);
  const { data: log } = await query;

  const guardianIds = [...new Set((log ?? []).filter((l) => l.recipient_type === "guardian").map((l) => l.recipient_id))];
  const staffIds = [...new Set((log ?? []).filter((l) => l.recipient_type === "staff").map((l) => l.recipient_id))];
  const [{ data: guardians }, { data: staff }] = await Promise.all([
    guardianIds.length
      ? supabase.from("guardians").select("id, name").in("id", guardianIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    staffIds.length
      ? supabase.from("staff").select("id, name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const guardianNames = Object.fromEntries((guardians ?? []).map((g) => [g.id, g.name]));
  const staffNames = Object.fromEntries((staff ?? []).map((s) => [s.id, s.name]));
  const recipientName = (recipientType: string, recipientId: string) =>
    (recipientType === "guardian" ? guardianNames[recipientId] : staffNames[recipientId]) ?? "Unknown";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Audit</p>
          <h1 className="mt-1 font-heading text-4xl text-maroon text-balance">Notification log</h1>
          <p className="mt-2 max-w-prose text-lg text-slate-strong">
            Every push notification the app has attempted to send, with who, what, and when — proof
            a parent or staff member was notified of something.
          </p>
        </div>
        <ExportCsvButton href="/api/export/notification-log" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/console/notification-log"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            !activeCategory ? "bg-rust text-white" : "border border-hairline bg-mist text-slate-strong hover:bg-parchment"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/console/notification-log?category=${c}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              activeCategory === c
                ? "bg-rust text-white"
                : "border border-hairline bg-mist text-slate-strong hover:bg-parchment"
            }`}
          >
            {c.replace("_", " ")}
          </Link>
        ))}
      </div>

      {!log || log.length === 0 ? (
        <p className="text-base text-slate">No notifications logged yet.</p>
      ) : (
        <ExpandableList
          initialCount={20}
          className="divide-y divide-hairline rounded-sm border border-hairline bg-surface shadow-[var(--shadow-card)]"
        >
          {log.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-maroon">
                  {l.title} — {recipientName(l.recipient_type, l.recipient_id)}
                </p>
                <p className="mt-0.5 text-sm text-slate-strong">{l.body}</p>
                <p className="mt-0.5 text-sm text-slate">
                  {formatDateTime(l.sent_at)} · <span className="capitalize">{l.category.replace("_", " ")}</span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  l.delivered
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                }`}
              >
                {l.delivered ? "Delivered" : "Not delivered"}
              </span>
            </li>
          ))}
        </ExpandableList>
      )}
    </div>
  );
}
