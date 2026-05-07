"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PayslipDetailsActions({ payslipId }: { payslipId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(url: string) {
    const res = await fetch(url, { method: "POST", credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
    return data;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
        href={`/api/payslips/${payslipId}/pdf`}
        target="_blank"
        rel="noreferrer"
      >
        PDF
      </a>
      <button
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post(`/api/payslips/${payslipId}/send`);
            toast.success("Email trimis");
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

