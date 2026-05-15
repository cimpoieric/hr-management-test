"use client";

import {
  fetchEmployerDetailsForPayslip,
  generateWeeklyPayslip,
  mapPayslipApiResponseToPayslipData,
} from "@/components/payroll/WeeklyPayslipPDF";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function PayslipDetailsActions({ payslipId }: { payslipId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function postJson(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      [k: string]: unknown;
    };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  async function handleDownloadPdf() {
    const [res, employer] = await Promise.all([
      fetch(`/api/payroll/${payslipId}`, {
        credentials: "same-origin",
        cache: "no-store",
      }),
      fetchEmployerDetailsForPayslip(),
    ]);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : "Eroare la citirea PDF",
      );
    }
    generateWeeklyPayslip(mapPayslipApiResponseToPayslipData(data, employer));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await handleDownloadPdf();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Eroare");
          } finally {
            setBusy(false);
          }
        }}
      >
        PDF
      </button>
      <button
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await postJson("/api/email/send", {
              type: "fluturas",
              data: { payslipId },
            });
            toast.success("Email trimis cu succes!");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Eroare");
          } finally {
            setBusy(false);
          }
        }}
      >
        Trimite email
      </button>
    </div>
  );
}
