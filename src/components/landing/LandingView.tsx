"use client";

import { PricingCards } from "@/components/pricing/PricingCards";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { StripePriceIds } from "@/lib/pricingPlans";
import { ROUTES } from "@/lib/routes";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  Languages,
  Play,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

type LandingViewProps = {
  stripePriceIds: StripePriceIds;
  salesEmail: string;
  trialDays: number;
  contactEmail: string;
  stripeCheckoutEnabled?: boolean;
};

function StarRow() {
  return (
    <div className="flex gap-0.5 text-amber-400" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-current" />
      ))}
    </div>
  );
}

export function LandingView({
  stripePriceIds,
  salesEmail,
  trialDays,
  contactEmail,
  stripeCheckoutEnabled = false,
}: LandingViewProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-blue-950"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950 text-white">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <span>{t("landing.brandName")}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-blue-950">
              {t("landing.navFeatures")}
            </a>
            <a href="#how-it-works" className="hover:text-blue-950">
              {t("landing.navHowItWorks")}
            </a>
            <a href="#pricing" className="hover:text-blue-950">
              {t("landing.navPricing")}
            </a>
            <a href="#faq" className="hover:text-blue-950">
              {t("landing.navFaq")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-slate-600"
            >
              <Link href="/login">{t("auth.login")}</Link>
            </Button>
            <Button asChild size="sm" className="bg-blue-950 hover:bg-blue-900">
              <Link href="/register">{t("landing.ctaStart")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(30,58,138,0.12),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24 lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-900">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("landing.heroBadge")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-blue-950 md:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-blue-950 px-8 text-base hover:bg-blue-900"
              >
                <Link href="/register">{t("landing.heroCtaTrial")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-blue-200 text-blue-950"
              >
                <Link href="#demo" className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4" aria-hidden />
                  {t("landing.heroCtaWatchDemo")}
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end">
            <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 shadow-xl">
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
              <div className="relative flex h-full flex-col items-center justify-center p-8 text-center text-white">
                <Users
                  className="mb-4 h-20 w-20 opacity-90"
                  strokeWidth={1}
                  aria-hidden
                />
                <p className="text-sm font-medium text-blue-100">
                  Product illustration
                </p>
                <p className="mt-1 text-xs text-blue-200/80">
                  Replace with your hero image or video
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURES */}
      <section
        id="features"
        className="scroll-mt-20 border-b border-slate-100 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
              Everything you need
            </h2>
            <p className="mt-3 text-slate-600">
              Six core areas to run HR operations without spreadsheet chaos.
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Employee Management",
                desc: "Centralized employee database with full profiles",
              },
              {
                icon: Clock,
                title: "Time Tracking",
                desc: "Clock in/out, overtime, leave management",
              },
              {
                icon: Wallet,
                title: "Payroll",
                desc: "Generate payslips, calculate deductions, export PDF",
              },
              {
                icon: FileText,
                title: "Documents",
                desc: "Store contracts, certificates, evaluations securely",
              },
              {
                icon: BarChart3,
                title: "Reports",
                desc: "Insightful reports on attendance, payroll, headcount",
              },
              {
                icon: Languages,
                title: "Multi-language",
                desc: "English and Romanian, more coming soon",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-950 text-white">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-blue-950">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO placeholder (Watch Demo target) */}
      <section
        id="demo"
        className="scroll-mt-20 border-b border-slate-100 bg-slate-50 py-12"
      >
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-xl font-semibold text-blue-950">Product demo</h2>
          <p className="mt-2 text-sm text-slate-600">
            Embed a Loom or YouTube video here. Placeholder below.
          </p>
          <div className="mt-6 flex aspect-video max-w-3xl mx-auto items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500">
            <div className="flex flex-col items-center gap-2 p-6">
              <Play className="h-12 w-12 text-blue-950 opacity-40" />
              <span className="text-sm font-medium">Video placeholder</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-b border-slate-100 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-slate-600">
              Three steps from signup to daily HR workflows.
            </p>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                step: "1",
                icon: Building2,
                title: "Create your organization",
                text: "Set up your company profile, language, and workspace in minutes.",
              },
              {
                step: "2",
                icon: UserPlus,
                title: "Add your employees",
                text: "Import or add people, documents, contracts, and payroll data securely.",
              },
              {
                step: "3",
                icon: Globe,
                title: "Start managing",
                text: "Track attendance, run payroll, export reports, and collaborate with your team.",
              },
            ].map((s) => (
              <div key={s.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-950 text-white shadow-lg">
                  <s.icon className="h-7 w-7" aria-hidden />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Step {s.step}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-blue-950">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PRICING */}
      <section
        id="pricing"
        className="scroll-mt-20 border-b border-slate-100 bg-slate-50 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
              Pricing
            </h2>
            <p className="mt-3 text-slate-600">
              {stripeCheckoutEnabled
                ? "Transparent plans. Start with a 14-day trial when you subscribe via Stripe."
                : "Transparent plans. Free registration with no online payment."}
            </p>
          </div>
          <div className="mt-12">
            <PricingCards
              stripePriceIds={stripePriceIds}
              salesEmail={salesEmail}
              trialDays={trialDays}
              stripeCheckoutEnabled={stripeCheckoutEnabled}
            />
          </div>
          <p className="mt-8 text-center text-xs text-slate-500">
            Need the full pricing page?{" "}
            <Link
              href={ROUTES.pricing}
              className="font-medium text-blue-950 underline"
            >
              Open /pricing
            </Link>
          </p>
        </div>
      </section>

      {/* 5. TESTIMONIALS */}
      <section className="border-b border-slate-100 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
              What teams say
            </h2>
            <p className="mt-3 text-slate-600">
              Placeholder testimonials - replace with real quotes.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Alexandra Ionescu",
                role: "HR Director",
                company: "LogiTrans SRL",
                body: "We finally replaced scattered spreadsheets. Onboarding new hires is twice as fast.",
              },
              {
                name: "Michael Schmidt",
                role: "Operations Lead",
                company: "EuroBuild GmbH",
                body: "Payroll exports and document expiry alerts save us hours every week. Highly recommended.",
              },
              {
                name: "Elena Popa",
                role: "Founder",
                company: "TechNest",
                body: "Clean UI, Romanian and English in one place. Our distributed team actually uses it.",
              },
            ].map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <StarRow />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  &quot;{t.body}&quot;
                </blockquote>
                <figcaption className="mt-6 border-t border-slate-100 pt-4">
                  <p className="font-semibold text-blue-950">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.role}, {t.company}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section
        id="faq"
        className="scroll-mt-20 border-b border-slate-100 py-16 md:py-24"
      >
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-center text-slate-600">
            Quick answers about plans, trials, and data.
          </p>
          <div className="mt-10 space-y-3">
            {[
              {
                q: "Can I switch plans?",
                a: "Yes. Upgrade or downgrade from billing settings or the Stripe Customer Portal when connected. Your organization admin can initiate changes anytime.",
              },
              {
                q: "What happens after the trial?",
                a: "After the 14-day trial, your subscription continues on the selected plan unless you cancel before the trial ends. You will be charged according to the Stripe price you chose at checkout.",
              },
              {
                q: "Is my data secure?",
                a: "Data is stored in your deployment database with tenant isolation. Use strong passwords, HTTPS in production, and regular backups for best protection.",
              },
              {
                q: "Can I export my data?",
                a: "Yes. The product includes exports for payroll, attendance, and related HR data in common formats such as Excel and PDF where applicable.",
              },
              {
                q: "Do you offer support in Romanian?",
                a: "The application supports Romanian and English in the interface. Support channels depend on your plan - email on Starter, faster response on higher tiers.",
              },
              {
                q: "Do I need a credit card for the free trial?",
                a: "Stripe Checkout may require a payment method depending on your Stripe account settings. You can offer 'no credit card' in marketing if your Stripe configuration allows trial without card.",
              },
              {
                q: "Can I self-host?",
                a: "This codebase is designed to run on your infrastructure. Enterprise and Custom plans can include dedicated deployment options - contact sales for details.",
              },
              {
                q: "How do I cancel?",
                a: "Organization admins can cancel through the Stripe Customer Portal or by contacting support. Access remains until the end of the paid period unless otherwise stated.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-200 bg-white px-4 py-1 open:shadow-md"
              >
                <summary className="cursor-pointer list-none py-3 font-medium text-blue-950 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </span>
                </summary>
                <p className="border-t border-slate-100 pb-4 pt-2 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="bg-blue-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to streamline your HR?
          </h2>
          <p className="mt-4 text-blue-100">
            Join teams that run payroll, documents, and attendance in one place.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-white px-10 text-base font-semibold text-blue-950 hover:bg-blue-50"
          >
            <Link href="/register">Start Your 14-Day Free Trial</Link>
          </Button>
          <p className="mt-4 text-sm text-blue-200">No credit card required</p>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-blue-950"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950 text-white">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              HR Management
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Modern HR software for employee records, attendance, payroll, and
              compliance documents. Built for clarity and scale.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="#features"
                  className="text-slate-600 hover:text-blue-950"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-slate-600 hover:text-blue-950"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-slate-600 hover:text-blue-950"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Legal
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-slate-600 hover:text-blue-950"
                >
                  Politică confidențialitate
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-slate-600 hover:text-blue-950"
                >
                  Termeni și condiții
                </Link>
              </li>
              <li>
                <Link
                  href="/gdpr"
                  className="text-slate-600 hover:text-blue-950"
                >
                  Drepturi GDPR
                </Link>
              </li>
              <li>
                <Link
                  href="/dpa"
                  className="text-slate-600 hover:text-blue-950"
                >
                  DPA
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-slate-200 px-4 pt-8 text-center text-xs text-slate-500">
          <p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-950 hover:underline"
            >
              {contactEmail}
            </a>
          </p>
          <p className="mt-2">
            &copy; 2025 HR Management. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
