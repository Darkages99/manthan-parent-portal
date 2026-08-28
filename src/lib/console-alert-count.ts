import type { ConsoleAlertData } from "@/lib/console-alerts";
import type { StaffAlert } from "@/components/console-alerts";

/** How many alert rows the panel would render — shared with the dashboard page so it can decide layout. */
export function countAlerts(data: ConsoleAlertData, staffAlerts: StaffAlert[] = []): number {
  return (data.absentToday.length > 0 ? 1 : 0) + (data.stayingBackToday.length > 0 ? 1 : 0) + staffAlerts.length;
}
