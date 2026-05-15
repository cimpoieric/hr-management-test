/**
 * Notify Plat? when pontaj hours/week change. BroadcastChannel works across same-origin tabs (no server).
 */
export const TIMESHEET_PAYROLL_SYNC_CHANNEL = "hr-timesheet-payroll-sync";

export type TimesheetPayrollSyncMessage = {
  type: "hoursUpdated";
  year: number;
  weekNumber: number;
};

export function broadcastTimesheetHoursForPayrollSync(
  year: number,
  weekNumber: number,
): void {
  if (typeof window === "undefined") return;
  try {
    const BC = (
      globalThis as unknown as { BroadcastChannel?: typeof BroadcastChannel }
    ).BroadcastChannel;
    if (!BC) return;
    const ch = new BC(TIMESHEET_PAYROLL_SYNC_CHANNEL);
    const msg: TimesheetPayrollSyncMessage = {
      type: "hoursUpdated",
      year,
      weekNumber,
    };
    ch.postMessage(msg);
    ch.close();
  } catch {
    /* older Safari / strict iframes */
  }
}
