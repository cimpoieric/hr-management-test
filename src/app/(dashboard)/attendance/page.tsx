import { TimesheetsTableClient } from "@/components/attendance/TimesheetsTableClient";
import { prisma } from "@/lib/prisma";
import { getInternalRequestOrigin } from "@/lib/request-origin";
import { getServerAppLanguage } from "@/lib/serverAppLanguage";
import { serverT } from "@/lib/serverTranslation";
import type { EmployeeOption, Pagination, TimesheetRow } from "@/types";
import type { SupportedLng } from "@/i18n/constants";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function parseIntSafe(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

async function fetchTimesheets(
  params: URLSearchParams,
  lng: SupportedLng,
): Promise<{ items: TimesheetRow[]; pagination: Pagination }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const url = `${origin}/api/attendance?${params.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      err.error ?? serverT(lng, "pages.attendance.fetchListError"),
    );
  }

  const data = (await res.json()) as {
    items: TimesheetRow[];
    pagination: Pagination;
  };
  return data;
}

export default async function AttendancePage({
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

  const lng = await getServerAppLanguage();

  const [timesheetsResult, employees] = await Promise.all([
    fetchTimesheets(qs, lng)
      .then((data) => ({ data, error: null as string | null }))
      .catch((e) => ({
        data: {
          items: [] as TimesheetRow[],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 1,
          } satisfies Pagination,
        },
        error:
          e instanceof Error
            ? e.message
            : serverT(lng, "pages.attendance.fetchListError"),
      })),
    prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }) as Promise<EmployeeOption[]>,
  ]);

  return (
    <TimesheetsTableClient
      items={timesheetsResult.data.items}
      pagination={timesheetsResult.data.pagination}
      employees={employees}
      filters={{ employeeId, year, weekNumber, status }}
      loadError={timesheetsResult.error}
    />
  );
}
