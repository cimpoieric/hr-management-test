import { TimesheetEditClient } from "@/components/attendance/timesheet-edit-client";
import { ROUTES } from "@/lib/routes";
import { prisma } from "@/lib/prisma";
import { getInternalRequestOrigin } from "@/lib/request-origin";
import type { EditTimesheet, EmployeeOption } from "@/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function fetchTimesheet(id: string): Promise<EditTimesheet> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const res = await fetch(`${origin}/api/attendance/${id}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Eroare la citirea pontajului";
    throw new Error(msg);
  }
  return data as EditTimesheet;
}

export default async function TimesheetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const [timesheet, employees] = await Promise.all([
      fetchTimesheet(id),
      prisma.employee.findMany({
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
    return <TimesheetEditClient timesheet={timesheet} employees={employees} />;
  } catch {
    redirect(ROUTES.timesheets);
  }
}
