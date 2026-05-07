import { cookies } from "next/headers";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";
import { prisma } from "@/lib/prisma";
import { getInternalRequestOrigin } from "@/lib/request-origin";
import {
  PayslipsTableClient,
  type PayslipListItem,
  type Pagination,
  type EmployeeOpt,
} from "./PayslipsTableClient";

export const dynamic = "force-dynamic";

function parseIntSafe(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

async function fetchPayslips(params: URLSearchParams): Promise<{ items: PayslipListItem[]; pagination: Pagination }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const url = `${origin}/api/payslips?${params.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Eroare la citirea fluturașilor");
  }

  const data = (await res.json()) as { items: PayslipListItem[]; pagination: Pagination };
  // Normalizează totalPaid: dacă e 0 dar există items, recalculează din items.
  const normalizedItems = (data.items ?? []).map((p) => {
    const netSalary = (p.items ?? [])
      .filter((i) => i.type === "NET_SALARY")
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const travel = (p.items ?? [])
      .filter((i) => i.type === "TRAVEL_ALLOWANCE")
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const itemSum = (p.items ?? []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

    const total = Number(p.totalPaid) || 0;
    const totalPaid = total === 0 && itemSum !== 0 ? itemSum : total;

    const net = Number(p.netTotal) || 0;
    const netTotal = net === 0 && netSalary !== 0 ? netSalary : net;

    // Travel se afișează din items în tabel; îl calculăm aici ca verificare/normalizare de date.
    void travel;

    return {
      ...p,
      netTotal: String(netTotal),
      totalPaid: String(totalPaid),
    };
  });
  return { ...data, items: normalizedItems };
}

export default async function FluturasiPage({
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
  const emailSent = get("emailSent");

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  if (employeeId) qs.set("employeeId", employeeId);
  if (year) qs.set("year", year);
  if (weekNumber) qs.set("weekNumber", weekNumber);
  if (emailSent === "true" || emailSent === "false") qs.set("emailSent", emailSent);

  const [payslips, employees] = await Promise.all([
    fetchPayslips(qs),
    prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }) as Promise<EmployeeOpt[]>,
  ]);

  return (
    <AuthenticatedDashboardShell>
      <PayslipsTableClient
        items={payslips.items}
        pagination={payslips.pagination}
        employees={employees}
        filters={{ employeeId, year, weekNumber, emailSent }}
      />
    </AuthenticatedDashboardShell>
  );
}

