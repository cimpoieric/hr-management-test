import Link from "next/link";
import { cookies } from "next/headers";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";
import { PayslipDetailsActions } from "@/components/payslips/PayslipDetailsActions";
import { getInternalRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

type PayslipItem = {
  id: number;
  type: string;
  label: string;
  description?: string | null;
  amount: string;
  quantity?: string | null;
  rate?: string | null;
  sortOrder: number;
};

type PayslipDetails = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossTotal: string;
  deductionsTotal: string;
  netTotal: string;
  totalPaid: string;
  pdfPath?: string | null;
  pdfGeneratedAt?: string | null;
  emailSent: boolean;
  emailSentAt?: string | null;
  employee: { firstName: string; lastName: string; position?: string | null };
  company: { name: string };
  timesheet: { hoursWorked: string; status: string };
  items: PayslipItem[];
};

function money(amount: unknown, currency: string): string {
  const v = typeof amount === "object" && amount !== null && "toString" in amount ? Number(String(amount)) : Number(amount);
  const n = Number.isFinite(v) ? v : 0;
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function fetchPayslip(id: string): Promise<PayslipDetails> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = await getInternalRequestOrigin();
  const res = await fetch(`${origin}/api/payslips/${id}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as PayslipDetails & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Eroare la citirea fluturașului");
  }
  return data;
}

export default async function PayslipDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payslip = await fetchPayslip(id);
  const currency = (payslip.currency || "EUR").toUpperCase();

  return (
    <AuthenticatedDashboardShell>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">
              <Link href="/fluturasi" className="underline">
                Înapoi la listă
              </Link>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Fluturaș #{payslip.id}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {payslip.employee.lastName} {payslip.employee.firstName}
              {payslip.employee.position ? ` — ${payslip.employee.position}` : ""} • Week {payslip.weekNumber}, {payslip.year}
            </p>
          </div>
          <PayslipDetailsActions payslipId={payslip.id} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs font-medium text-gray-500">Ore lucrate</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{payslip.timesheet.hoursWorked}</div>
            <div className="mt-1 text-xs text-gray-500">Status pontaj: {payslip.timesheet.status}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs font-medium text-gray-500">Total plătit</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{money(payslip.totalPaid, currency)}</div>
            <div className="mt-1 text-xs text-gray-500">Email: {payslip.emailSent ? "trimis" : "netrimis"}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs font-medium text-gray-500">Companie</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{payslip.company.name}</div>
            <div className="mt-1 text-xs text-gray-500">Monedă: {currency}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">Iteme</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tip</th>
                  <th className="px-4 py-3 text-left">Etichetă</th>
                  <th className="px-4 py-3 text-left">Detalii</th>
                  <th className="px-4 py-3 text-right">Sumă</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payslip.items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{it.type}</td>
                    <td className="px-4 py-3 text-gray-900">{it.label}</td>
                    <td className="px-4 py-3 text-gray-600">{it.description ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{money(it.amount, currency)}</td>
                  </tr>
                ))}
                {payslip.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      Nu există iteme pe fluturaș.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthenticatedDashboardShell>
  );
}

