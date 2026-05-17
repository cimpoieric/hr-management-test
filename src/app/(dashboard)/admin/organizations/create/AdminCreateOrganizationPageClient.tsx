"use client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRICING_PLANS, type PricingPlanId } from "@/lib/pricingPlans";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PLAN_KEYS: PricingPlanId[] = [
  "starter",
  "business",
  "enterprise",
  "custom",
];

export default function AdminCreateOrganizationPageClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<PricingPlanId>("starter");
  const [startAsActive, setStartAsActive] = useState(true);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!companyName.trim()) {
      toast.error("Numele firmei este obligatoriu.");
      return;
    }
    if (!adminEmail.trim()) {
      toast.error("Email-ul administratorului este obligatoriu.");
      return;
    }
    if (password.length < 8) {
      toast.error("Parola trebuie sa aiba minim 8 caractere.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminEmail: adminEmail.trim(),
          adminName: adminName.trim() || undefined,
          password,
          plan,
          startAsActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Nu s-a putut crea organizatia.",
        );
      }
      toast.success("Organizatia a fost creata.");
      router.push("/admin/companies");
      router.refresh();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "Eroare neasteptata.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <AdminPageHeader
        title="Adauga organizatie"
        description="Creeaza o firma noua si contul administratorului HR."
      />

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4 rounded-xl border bg-white p-6"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="companyName">
            Nume firma
          </label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Ex: SC Exemplu SRL"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="adminName">
            Nume administrator (optional)
          </label>
          <Input
            id="adminName"
            value={adminName}
            onChange={(event) => setAdminName(event.target.value)}
            placeholder="Ex: Ion Popescu"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="adminEmail">
            Email administrator
          </label>
          <Input
            id="adminEmail"
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            placeholder="admin@firma.ro"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            Parola administrator
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="plan">
            Plan abonament
          </label>
          <select
            id="plan"
            value={plan}
            onChange={(event) => setPlan(event.target.value as PricingPlanId)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {PLAN_KEYS.map((key) => {
              const meta = PRICING_PLANS.find((p) => p.id === key);
              return (
                <option key={key} value={key}>
                  {meta?.name ?? key.toUpperCase()}
                </option>
              );
            })}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={startAsActive}
            onChange={(event) => setStartAsActive(event.target.checked)}
            className="rounded border-slate-300"
          />
          Activeaza imediat (fara perioada trial)
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Creeaza organizatia"
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/companies">Anuleaza</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
