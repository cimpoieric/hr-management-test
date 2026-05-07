import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";
import { prisma } from "@/lib/prisma";
import { getInternalRequestOrigin } from "@/lib/request-origin";
import { TimesheetEditClient, type EditTimesheet } from "./timesheet-edit-client";

export const dynamic = "force-dynamic";

async function fetchTimesheet(id: string): Promise<EditTimesheet> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const res = await fetch(`${origin}/api/timesheets/${id}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data.error ?? "Eroare la citirea pontajului");
  return data as EditTimesheet;
}

export default async function TimesheetEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [timesheet, employees] = await Promise.all([
      fetchTimesheet(id),
      prisma.employee.findMany({
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
    return (
      <AuthenticatedDashboardShell>
        <TimesheetEditClient timesheet={timesheet} employees={employees} />
      </AuthenticatedDashboardShell>
    );
  } catch {
    redirect("/pontaj");
  }
}

