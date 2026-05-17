import "server-only";

import type { AuthContext } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { prismaBase as prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/roles";
import { salaryAmountToJson } from "@/lib/salaryFields";

export const GDPR_REQUEST_TYPES = [
  "DELETE",
  "ACCESS",
  "RECTIFY",
  "PORTABILITY",
  "OPPOSITION",
] as const;

export type GdprRequestType = (typeof GDPR_REQUEST_TYPES)[number];

export const GDPR_REQUEST_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "rejected",
] as const;

export type GdprRequestStatus = (typeof GDPR_REQUEST_STATUSES)[number];

/** Links User (JWT) to Employee by email in the same organization. */
export async function resolveEmployeeForUser(user: AuthContext) {
  const email = user.email.trim().toLowerCase();
  return prisma.employee.findFirst({
    where: {
      organizationId: user.organizationId,
      email: { equals: email },
    },
  });
}

export function assertEmployeeSelfService(user: AuthContext): void {
  if (user.role !== UserRole.EMPLOYEE) {
    throw new Error("EMPLOYEE_ROLE_REQUIRED");
  }
}

export async function buildEmployeePortableExport(employeeId: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      company: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      timesheets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          periodKey: true,
          weekNumber: true,
          year: true,
          month: true,
          monthYear: true,
          startDate: true,
          endDate: true,
          hoursWorked: true,
          standardHours: true,
          travelAllowance: true,
          status: true,
          notes: true,
          submittedAt: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      payslips: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          timesheetId: true,
          type: true,
          weekNumber: true,
          year: true,
          month: true,
          monthYear: true,
          periodStart: true,
          periodEnd: true,
          grossTotal: true,
          deductionsTotal: true,
          netTotal: true,
          totalPaid: true,
          currency: true,
          emailSent: true,
          emailSentAt: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              type: true,
              label: true,
              description: true,
              amount: true,
            },
          },
        },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          number: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          status: true,
          issueDate: true,
          expiryDate: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!employee) return null;

  let cnpPlain: string | null = null;
  let ibanPlain: string | null = null;
  try {
    cnpPlain = decrypt(employee.cnpEncrypted);
  } catch {
    cnpPlain = null;
  }
  if (employee.iban) {
    try {
      ibanPlain = decrypt(employee.iban);
    } catch {
      ibanPlain = null;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    employee: {
      id: employee.id,
      organizationId: employee.organizationId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      cnp: cnpPlain,
      seriesCI: employee.seriesCI,
      numberCI: employee.numberCI,
      email: employee.email,
      phone: employee.phone,
      iban: ibanPlain,
      bankName: employee.bankName,
      position: employee.position,
      address: employee.address,
      city: employee.city,
      country: employee.country,
      status: employee.status,
      observations: employee.observations,
      workNorm: employee.workNorm,
      salaryType: employee.salaryType,
      salaryAmount: salaryAmountToJson(employee.salaryAmount),
      salaryCurrency: employee.salaryCurrency,
      salaryStartDate: employee.salaryStartDate,
      paymentFrequency: employee.paymentFrequency,
      company: employee.company,
      hiredAt: employee.hiredAt,
      gdprInformedAt: employee.gdprInformedAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    },
    timesheets: employee.timesheets.map((t) => ({
      ...t,
      hoursWorked: Number(t.hoursWorked),
      standardHours: Number(t.standardHours),
    })),
    payslips: employee.payslips.map((p) => ({
      id: p.id,
      timesheetId: p.timesheetId,
      type: p.type,
      weekNumber: p.weekNumber,
      year: p.year,
      month: p.month,
      monthYear: p.monthYear,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      grossTotal: Number(p.grossTotal),
      deductionsTotal: Number(p.deductionsTotal),
      netTotal: Number(p.netTotal),
      totalPaid: Number(p.totalPaid),
      currency: p.currency,
      emailSent: p.emailSent,
      emailSentAt: p.emailSentAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      items: p.items.map((i) => ({
        ...i,
        amount: Number(i.amount),
      })),
    })),
    documents: employee.documents,
  };
}
