const styles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const labels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

export function StatusPill({ status }: { status: "pending" | "approved" | "declined" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
