"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DedupeModal, DedupeResult } from "@/components/dedupe-modal";

type EmployeeFormData = {
  cnp: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  iban: string;
  bankName: string;
  address: string;
  city: string;
  companyId: number;
};

const initialForm: EmployeeFormData = {
  cnp: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  iban: "",
  bankName: "",
  address: "",
  city: "",
  companyId: 1,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
    />
  );
}

export default function EmployeeForm() {
  const router = useRouter();
  const [form, setForm] = useState<EmployeeFormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [pendingDedupe, setPendingDedupe] = useState<{
    result: DedupeResult;
    incoming: EmployeeFormData;
  } | null>(null);

  const updateField = useCallback(
    <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPendingDedupe(null);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          phone: form.phone || null,
          iban: form.iban || null,
          bankName: form.bankName || null,
          address: form.address || null,
          city: form.city || null,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.dedupe?.action === "REVIEW") {
        // Flow: C există, match < 80% → arată ambele (REVIEW)
        setPendingDedupe({ result: data.dedupe, incoming: form });
        setLoading(false);
        return;
      }

      if (res.status === 200 && data.result === "UPDATED") {
        // Flow: C există, match > 80% → UPDATE automat sau notificare
        alert("Angajat actualizat cu succes!");
        setForm(initialForm);
        router.refresh();
        setLoading(false);
        return;
      }

      if (res.status === 201 && data.result === "CREATED") {
        // Flow: C nu există → creare directă
        alert("Angajat creat cu succes!");
        setForm(initialForm);
        router.refresh();
        setLoading(false);
        return;
      }

      if (!res.ok) {
        alert(data.error ?? "Eroare la salvare");
      }
    } catch {
      alert("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  };

  const handleDedupeConfirm = async (
    action: "CREATE" | "UPDATE",
    employeeId?: number
  ) => {
    if (!pendingDedupe) return;
    setLoading(true);

    try {
      const payload = {
        ...pendingDedupe.incoming,
        email: pendingDedupe.incoming.email || null,
        phone: pendingDedupe.incoming.phone || null,
        iban: pendingDedupe.incoming.iban || null,
        bankName: pendingDedupe.incoming.bankName || null,
        address: pendingDedupe.incoming.address || null,
        city: pendingDedupe.incoming.city || null,
      };

      if (action === "UPDATE" && employeeId) {
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.result === "UPDATED") {
          alert("Angajat actualizat cu succes!");
        } else {
          alert(data.error ?? "Eroare la actualizare");
        }
      } else {
        // FORCE CREATE — duplicat intenționat, userul a decis să creeze nou
        // Aici poți adăuga un flag `forceCreate: true` pe backend dacă vrei să blochezi duplicatele CNP cu totul
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, forceCreate: true }),
        });
        const data = await res.json();
        if (res.ok) {
          alert("Angajat creat (override duplicat)!");
        } else {
          alert(data.error ?? "Eroare");
        }
      }

      setPendingDedupe(null);
      setForm(initialForm);
      router.refresh();
    } catch {
      alert("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <h2 className="text-xl font-semibold mb-4">Adaugă angajat</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>CNP *</Label>
            <Input
              value={form.cnp}
              onChange={(v) => updateField("cnp", v.replace(/\D/g, ""))}
              placeholder="1881234567890"
              maxLength={13}
            />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
              placeholder="0722 123 456"
              maxLength={20}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nume *</Label>
            <Input
              value={form.lastName}
              onChange={(v) => updateField("lastName", v)}
              placeholder="Popescu"
            />
          </div>
          <div>
            <Label>Prenume *</Label>
            <Input
              value={form.firstName}
              onChange={(v) => updateField("firstName", v)}
              placeholder="Ion"
            />
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <Input
            value={form.email}
            onChange={(v) => updateField("email", v)}
            placeholder="ion.popescu@example.com"
            type="email"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>IBAN</Label>
            <Input
              value={form.iban}
              onChange={(v) => updateField("iban", v)}
              placeholder="RO49AAAA..."
              maxLength={34}
            />
          </div>
          <div>
            <Label>Bancă</Label>
            <Input
              value={form.bankName}
              onChange={(v) => updateField("bankName", v)}
              placeholder="ING Bank"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Oraș</Label>
            <Input
              value={form.city}
              onChange={(v) => updateField("city", v)}
              placeholder="București"
            />
          </div>
          <div>
            <Label>Adresă</Label>
            <Input
              value={form.address}
              onChange={(v) => updateField("address", v)}
              placeholder="Str. Exemplu nr. 1"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || form.cnp.length !== 13 || !form.firstName || !form.lastName}
            className="px-6 py-2.5 rounded-lg bg-zinc-950 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Se procesează..." : "Salvează angajat"}
          </button>
        </div>
      </form>

      {pendingDedupe && (
        <DedupeModal
          dedupe={pendingDedupe.result}
          incoming={pendingDedupe.incoming}
          onConfirm={handleDedupeConfirm}
          onCancel={() => setPendingDedupe(null)}
        />
      )}
    </>
  );
}
