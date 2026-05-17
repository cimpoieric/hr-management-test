"use client";

import { Button } from "@/components/ui/button";
import { PRICING_PLANS, type PricingPlanId } from "@/lib/pricingPlans";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-950/20 focus:ring-2";

type ApiIssue = { path: (string | number)[]; message: string };

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyCui, setCompanyCui] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [planId, setPlanId] = useState<PricingPlanId | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToDpa, setAgreedToDpa] = useState(false);

  function validateStep1(): boolean {
    if (!companyName.trim()) {
      toast.error("Company name is required.");
      return false;
    }
    if (
      !companyEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)
    ) {
      toast.error("Valid company email is required.");
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!adminName.trim()) {
      toast.error("Admin name is required.");
      return false;
    }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      toast.error("Valid admin email is required.");
      return false;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!planId) {
      toast.error("Please select a plan.");
      return false;
    }
    if (!agreedToTerms) {
      toast.error("You must accept the Terms and Privacy Policy.");
      return false;
    }
    if (!agreedToDpa) {
      toast.error(
        "You must accept the Data Processing Agreement (DPA) and Privacy Policy.",
      );
      return false;
    }
    return true;
  }

  function goNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep3()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName,
          companyCui: companyCui || null,
          companyAddress: companyAddress || null,
          companyPhone: companyPhone || null,
          companyEmail,
          adminName,
          adminEmail,
          password,
          confirmPassword,
          planId,
          agreedToTerms,
          agreedToDpa,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        redirectPath?: string;
        error?: string;
        issues?: ApiIssue[];
      };

      if (!res.ok) {
        if (data.issues?.length) {
          const first = data.issues[0];
          toast.error(first?.message ?? data.error ?? "Registration failed.");
        } else {
          toast.error(data.error ?? "Registration failed.");
        }
        setSubmitting(false);
        return;
      }

      window.location.href = data.redirectPath ?? "/onboarding";
    } catch {
      toast.error("Network error.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-blue-950 hover:underline"
          >
            &larr; Home
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-blue-950">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            3 steps: organization, admin, and plan — free registration, no
            payment required.
          </p>
        </div>

        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                  step === n
                    ? "bg-blue-950 text-white"
                    : step > n
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-300 bg-white text-slate-500",
                )}
              >
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              {n < 3 ? (
                <div
                  className={cn(
                    "h-0.5 w-8 rounded-full",
                    step > n ? "bg-emerald-500" : "bg-slate-200",
                  )}
                />
              ) : null}
            </div>
          ))}
        </div>

        <form
          onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
        >
          {step === 1 ? (
            <div className="space-y-4">
              <div className="mb-2 flex items-center gap-2 text-blue-950">
                <Building2 className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Organization</h2>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Company name <span className="text-red-600">*</span>
                </label>
                <input
                  className={inputClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Company CUI / CIF
                </label>
                <input
                  className={inputClass}
                  value={companyCui}
                  onChange={(e) => setCompanyCui(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Company address
                </label>
                <input
                  className={inputClass}
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  autoComplete="street-address"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Company phone
                </label>
                <input
                  className={inputClass}
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Company email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="mb-2 flex items-center gap-2 text-blue-950">
                <User className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Administrator</h2>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Admin name <span className="text-red-600">*</span>
                </label>
                <input
                  className={inputClass}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Admin email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Minimum 8 characters.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Confirm password <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-blue-950">
                Choose your plan
              </h2>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Choose a plan for your organization. Registration is free and
                starts with a trial — no payment required.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PRICING_PLANS.map((plan) => {
                  const selected = planId === plan.id;
                  return (
                    <label
                      key={plan.id}
                      className={cn(
                        "relative cursor-pointer rounded-xl border-2 p-4 transition hover:border-blue-300",
                        selected
                          ? "border-blue-950 bg-blue-50/50 ring-2 ring-blue-950/20"
                          : "border-slate-200",
                        plan.recommended && "ring-1 ring-amber-300/60",
                      )}
                    >
                      <input
                        type="radio"
                        name="plan"
                        className="sr-only"
                        checked={selected}
                        onChange={() => setPlanId(plan.id)}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-blue-950">
                            {plan.name}
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {plan.priceLei}{" "}
                            <span className="text-sm font-normal text-slate-600">
                              LEI/mo
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                            selected
                              ? "border-blue-950 bg-blue-950 text-white"
                              : "border-slate-300",
                          )}
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                      </div>
                      {plan.recommended ? (
                        <span className="mt-2 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Recommended
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-950"
                  checked={agreedToDpa}
                  onChange={(e) => setAgreedToDpa(e.target.checked)}
                  required
                />
                <span>
                  Sunt de acord cu{" "}
                  <Link
                    href="/dpa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-950 underline"
                  >
                    Acordul de Prelucrare a Datelor (DPA)
                  </Link>{" "}
                  si{" "}
                  <Link
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-950 underline"
                  >
                    Politica de Confidentialitate
                  </Link>
                  .
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-950"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-950 underline"
                  >
                    Terms
                  </Link>
                  .
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={submitting}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button
                type="button"
                className="bg-blue-950 hover:bg-blue-900"
                onClick={goNext}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="bg-blue-950 hover:bg-blue-900"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>Create free account</>
                )}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-950 hover:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Setup wizard for local installs:{" "}
          <Link href="/setup" className="text-blue-950 underline">
            /setup
          </Link>
        </p>
      </div>
    </div>
  );
}
