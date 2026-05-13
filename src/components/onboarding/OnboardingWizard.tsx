"use client";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TOTAL_STEPS = 4;

const WEEKDAY_ORDER = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

type Weekday = (typeof WEEKDAY_ORDER)[number];

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

type Department =
  | "HR"
  | "IT"
  | "Sales"
  | "Marketing"
  | "Operations"
  | "Finance"
  | "Other";

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "HR", label: "HR" },
  { value: "IT", label: "IT" },
  { value: "Sales", label: "Sales" },
  { value: "Marketing", label: "Marketing" },
  { value: "Operations", label: "Operations" },
  { value: "Finance", label: "Finance" },
  { value: "Other", label: "Other" },
];

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950";

type OnboardingForm = {
  firstName: string;
  lastName: string;
  position: string;
  department: Department | "";
  phone: string;
  cnp: string;
  address: string;
  emergencyContact: string;
  bankAccount: string;
  bankName: string;
  workStart: string;
  workEnd: string;
  workdays: Weekday[];
  lateToleranceMinutes: number;
};

const defaultForm: OnboardingForm = {
  firstName: "",
  lastName: "",
  position: "",
  department: "",
  phone: "",
  cnp: "",
  address: "",
  emergencyContact: "",
  bankAccount: "",
  bankName: "",
  workStart: "09:00",
  workEnd: "17:00",
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  lateToleranceMinutes: 10,
};

function sortWorkdays(days: Weekday[]): Weekday[] {
  return WEEKDAY_ORDER.filter((d) => days.includes(d));
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OnboardingForm>(defaultForm);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/onboarding/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Could not load onboarding status.");
        return;
      }
      const data = (await res.json()) as { needsOnboarding?: boolean };
      if (!data.needsOnboarding) {
        router.replace(ROUTES.dashboard);
        return;
      }
    } finally {
      setStatusLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const update = <K extends keyof OnboardingForm>(
    key: K,
    value: OnboardingForm[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const toggleWorkday = (day: Weekday) => {
    setForm((f) => {
      const has = f.workdays.includes(day);
      const workdays = has
        ? f.workdays.filter((d) => d !== day)
        : [...f.workdays, day];
      return { ...f, workdays };
    });
  };

  const validateStep2 = (): boolean => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.");
      return false;
    }
    if (!form.cnp.trim()) {
      toast.error("CNP is required.");
      return false;
    }
    if (!form.department) {
      toast.error("Please select a department.");
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (form.workdays.length === 0) {
      toast.error("Select at least one workday.");
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const complete = async () => {
    if (!validateStep2() || !validateStep3()) return;
    setSubmitting(true);
    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        position: form.position.trim() || null,
        department: form.department,
        phone: form.phone.trim() || null,
        cnp: form.cnp.trim(),
        address: form.address.trim() || null,
        emergencyContact: form.emergencyContact.trim() || null,
        bankAccount: form.bankAccount.trim() || null,
        bankName: form.bankName.trim() || null,
        workStart: form.workStart,
        workEnd: form.workEnd,
        workdays: sortWorkdays(form.workdays),
        lateToleranceMinutes: form.lateToleranceMinutes,
      };

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (res.status === 409) {
        toast.message(
          payload.error ?? "This organization already has employees.",
        );
        router.replace(ROUTES.dashboard);
        return;
      }

      if (!res.ok) {
        toast.error(payload.error ?? "Save failed.");
        return;
      }

      toast.success("Setup complete.");
      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <span>Loading...</span>
      </div>
    );
  }

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-slate-500">
          <span>
            Step {step} of {TOTAL_STEPS}
          </span>
          <span>
            {step === 1 && "Welcome"}
            {step === 2 && "First employee"}
            {step === 3 && "Attendance"}
            {step === 4 && "Finish"}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">
              Welcome! Let&apos;s set up your organization.
            </h1>
            <p className="text-sm text-slate-600">
              You will add your profile as the first employee (admin) and
              initial attendance rules. Use Next to continue.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              First employee (you)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First name
                </label>
                <input
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Position
                </label>
                <input
                  className={inputClass}
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  className={inputClass}
                  value={form.department}
                  onChange={(e) =>
                    update("department", e.target.value as Department | "")
                  }
                >
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  inputMode="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  CNP
                </label>
                <input
                  className={inputClass}
                  value={form.cnp}
                  onChange={(e) => update("cnp", e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  className={inputClass}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Emergency contact
                </label>
                <input
                  className={inputClass}
                  value={form.emergencyContact}
                  onChange={(e) => update("emergencyContact", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Bank account (IBAN)
                </label>
                <input
                  className={inputClass}
                  value={form.bankAccount}
                  onChange={(e) =>
                    update("bankAccount", e.target.value.toUpperCase())
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Bank name
                </label>
                <input
                  className={inputClass}
                  value={form.bankName}
                  onChange={(e) => update("bankName", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Attendance settings
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Workday start
                </label>
                <input
                  type="time"
                  className={inputClass}
                  value={form.workStart}
                  onChange={(e) => update("workStart", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Workday end
                </label>
                <input
                  type="time"
                  className={inputClass}
                  value={form.workEnd}
                  onChange={(e) => update("workEnd", e.target.value)}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Workdays (Mon-Fri selected by default)
              </p>
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_ORDER.map((d) => (
                  <label
                    key={d}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-950"
                      checked={form.workdays.includes(d)}
                      onChange={() => toggleWorkday(d)}
                    />
                    {WEEKDAY_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Late tolerance (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                className={inputClass}
                value={form.lateToleranceMinutes}
                onChange={(e) =>
                  update(
                    "lateToleranceMinutes",
                    Math.min(240, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">
                {form.firstName} {form.lastName}
              </dd>
              <dt className="text-slate-500">Department</dt>
              <dd className="font-medium text-slate-900">
                {form.department || "-"}
              </dd>
              <dt className="text-slate-500">Schedule</dt>
              <dd className="font-medium text-slate-900">
                {form.workStart} - {form.workEnd}
              </dd>
              <dt className="text-slate-500">Workdays</dt>
              <dd className="font-medium text-slate-900">
                {sortWorkdays(form.workdays)
                  .map((d) => WEEKDAY_LABELS[d])
                  .join(", ")}
              </dd>
              <dt className="text-slate-500">Late tolerance</dt>
              <dd className="font-medium text-slate-900">
                {form.lateToleranceMinutes} min
              </dd>
            </dl>
            <p className="text-xs text-slate-500">
              Complete Setup saves the employee and settings, then sends you to
              the dashboard.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || submitting}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext} disabled={submitting}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={complete} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
