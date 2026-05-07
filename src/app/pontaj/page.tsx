import { cookies } from "next/headers";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";
import { prisma } from "@/lib/prisma";
import { getInternalRequestOrigin } from "@/lib/request-origin";
import {
  TimesheetsTableClient,
  type TimesheetRow,
  type Pagination,
  type EmployeeOpt,
} from "./TimesheetsTableClient";

export const dynamic = "force-dynamic";

function parseIntSafe(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

async function fetchTimesheets(params: URLSearchParams): Promise<{ items: TimesheetRow[]; pagination: Pagination }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const url = `${origin}/api/timesheets?${params.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Eroare la citirea pontajelor");
  }

  const data = (await res.json()) as { items: TimesheetRow[]; pagination: Pagination };
  return data;
}

export default async function PontajPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const spObj = (await searchParams) ?? {};
  const get = (k: string) => {
    const v = spObj[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, parseIntSafe(get("page"), 1));
  const pageSizeRaw = parseIntSafe(get("pageSize"), 50);
  const pageSize = Math.min(200, Math.max(1, pageSizeRaw));

  const employeeId = get("employeeId");
  const year = get("year");
  const weekNumber = get("weekNumber");
  const status = get("status");

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  if (employeeId && employeeId !== "null") qs.set("employeeId", employeeId);
  if (year && year !== "null") qs.set("year", year);
  if (weekNumber && weekNumber !== "null") qs.set("weekNumber", weekNumber);
  if (status && status !== "null") qs.set("status", status);

  const [timesheetsResult, employees] = await Promise.all([
    fetchTimesheets(qs)
      .then((data) => ({ data, error: null as string | null }))
      .catch((e) => ({
        data: {
          items: [] as TimesheetRow[],
          pagination: { page, pageSize, total: 0, totalPages: 1 } satisfies Pagination,
        },
        error: e instanceof Error ? e.message : "Eroare la citirea pontajelor",
      })),
    prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }) as Promise<EmployeeOpt[]>,
  ]);

  return (
    <AuthenticatedDashboardShell>
      <TimesheetsTableClient
        items={timesheetsResult.data.items}
        pagination={timesheetsResult.data.pagination}
        employees={employees}
        filters={{ employeeId, year, weekNumber, status }}
      />
    </AuthenticatedDashboardShell>
  );
}

