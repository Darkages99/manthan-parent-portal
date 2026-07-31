/**
 * Shared logic for the parent dashboard "Alerts" section.
 *
 * Report-card acknowledgement is tracked in `localStorage` (per device) rather
 * than the database: opening the Results page records a signature of the
 * currently-published report cards, and the dashboard hides the alert while the
 * stored signature still matches. Publishing a new card changes the signature,
 * so the alert reappears until the parent revisits Results.
 *
 * TODO(fees): the "pay fees" alert is a placeholder until the payments/invoices
 * backend lands (Phase 2). Once invoices are wired, derive `feeDue` from
 * outstanding invoices (status 'due' | 'overdue' | 'partially_paid') so it
 * clears itself when fees are paid. See src/app/(parent)/payments/page.tsx.
 */

const RC_SEEN_PREFIX = "mv-rc-seen:";

/** Stable signature for a student's published report cards (order-independent). */
export function reportCardSignature(urls: (string | null | undefined)[]): string {
  return urls
    .filter((u): u is string => !!u)
    .sort()
    .join("|");
}

export function reportCardSeenKey(studentId: string): string {
  return `${RC_SEEN_PREFIX}${studentId}`;
}

/** Read the acknowledged signature for a student, or null. Client-only. */
export function readReportCardSeen(studentId: string): string | null {
  try {
    return localStorage.getItem(reportCardSeenKey(studentId));
  } catch {
    return null;
  }
}

/** Record that the parent has opened this student's report card(s). Client-only. */
export function writeReportCardSeen(studentId: string, signature: string): void {
  try {
    if (signature) localStorage.setItem(reportCardSeenKey(studentId), signature);
  } catch {
    // Ignore — private mode / storage disabled just means the alert stays.
  }
}

export type StudentAlertState = {
  id: string;
  name: string;
  /** An open PTM slot exists for the child's class and none is booked for them. */
  ptmNeedsBooking: boolean;
  /** At least one report card PDF is published for this child. */
  reportCardAvailable: boolean;
  /** Signature of the published report cards, matched against localStorage. */
  reportCardSignature: string;
};

export type DashboardAlertData = {
  /** Placeholder until the fees backend exists — see TODO above. */
  feeDue: boolean;
  students: StudentAlertState[];
};
