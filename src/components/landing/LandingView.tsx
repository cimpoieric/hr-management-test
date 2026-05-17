"use client";

import { PricingCards } from "@/components/pricing/PricingCards";
import VideoPlayer from "@/components/VideoPlayer";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useTranslation } from "@/hooks/useTranslation";
import type { StripePriceIds } from "@/lib/pricingPlans";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  Clock,
  FileText,
  FolderOpen,
  Globe,
  Menu,
  Play,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

type LandingViewProps = {
  stripePriceIds: StripePriceIds;
  salesEmail: string;
  trialDays: number;
  contactEmail: string;
  stripeCheckoutEnabled?: boolean;
};

export function LandingView({
  stripePriceIds,
  salesEmail,
  trialDays,
  contactEmail,
  stripeCheckoutEnabled = false,
}: LandingViewProps) {
  const { t } = useTranslation();
  useScrollAnimation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaqIndex = (index: number) => {
    setOpenFaqIndex((current) => (current === index ? null : index));
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = ["features", "how-it-works", "pricing", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActiveSection(id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navLinkClass = (sectionId: string) =>
    cn(
      "text-gray-300 hover:text-white transition-colors duration-200",
      activeSection === sectionId && "text-brand-blue",
    );

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-transparent text-white">
      <header
        className={cn(
          "fixed top-0 w-full z-50 transition-all duration-300",
          scrolled ? "glass border-b border-white/10" : "bg-transparent",
        )}
      >
        <div className="relative z-50 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950 text-white">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-xl font-bold tracking-wider text-white">
              {t("landing.brandName")}
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet" />
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#features" className={navLinkClass("features")}>
              {t("landing.navFeatures")}
            </a>
            <a href="#how-it-works" className={navLinkClass("how-it-works")}>
              {t("landing.navHowItWorks")}
            </a>
            <a href="#pricing" className={navLinkClass("pricing")}>
              {t("landing.navPricing")}
            </a>
            <a href="#faq" className={navLinkClass("faq")}>
              {t("landing.navFaq")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="mr-4 hidden text-gray-300 transition-colors hover:text-white md:inline"
            >
              {t("auth.login")}
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-5 py-2 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow-blue md:inline"
            >
              {t("landing.ctaStart")}
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg p-2 text-white md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? (
                <X className="h-6 w-6" aria-hidden />
              ) : (
                <Menu className="h-6 w-6" aria-hidden />
              )}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="glass fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 md:hidden">
            <nav className="flex flex-col items-center gap-6">
              <a
                href="#features"
                className={cn("text-2xl text-white", navLinkClass("features"))}
                onClick={closeMobile}
              >
                {t("landing.navFeatures")}
              </a>
              <a
                href="#how-it-works"
                className={cn(
                  "text-2xl text-white",
                  navLinkClass("how-it-works"),
                )}
                onClick={closeMobile}
              >
                {t("landing.navHowItWorks")}
              </a>
              <a
                href="#pricing"
                className={cn("text-2xl text-white", navLinkClass("pricing"))}
                onClick={closeMobile}
              >
                {t("landing.navPricing")}
              </a>
              <a
                href="#faq"
                className={cn("text-2xl text-white", navLinkClass("faq"))}
                onClick={closeMobile}
              >
                {t("landing.navFaq")}
              </a>
            </nav>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/login"
                className="text-2xl text-gray-300 transition-colors hover:text-white"
                onClick={closeMobile}
              >
                {t("auth.login")}
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-6 py-3 text-lg font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow-blue"
                onClick={closeMobile}
              >
                {t("landing.ctaStart")}
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* 1. HERO */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-navy-900 pt-16">
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 animate-float rounded-full bg-brand-blue/20 blur-3xl" />
        <div
          className="pointer-events-none absolute bottom-1/4 right-1/4 h-80 w-80 animate-float rounded-full bg-brand-violet/20 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="pointer-events-none absolute right-1/3 top-1/3 h-64 w-64 animate-float rounded-full bg-brand-teal/10 blur-3xl"
          style={{ animationDelay: "4s" }}
        />
        <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-900 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 lg:pr-[460px]">
          <p className="glass gradient-border mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-gray-300">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {t("landing.heroBadge")}
          </p>
          <h1 className="gradient-text text-5xl font-bold leading-tight md:text-7xl">
            {t("landing.heroTitle")
              .split(/,\s*/)
              .map((line, index, parts) => (
                <span key={index} className="block">
                  {index === 0 && parts.length > 1 ? `${line},` : line}
                </span>
              ))}
          </h1>
          <p className="mt-6 max-w-xl text-xl text-gray-400">
            {t("landing.heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-8 py-4 font-semibold text-white transition-all hover:-translate-y-1 hover:shadow-glow-blue"
            >
              {t("landing.heroCtaTrial")}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href="#demo"
              className="glass inline-flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white transition-all hover:bg-white/10"
            >
              <Play className="h-5 w-5" aria-hidden />
              {t("landing.heroCtaWatchDemo")}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>14-day free trial</span>
            <span aria-hidden>{"\u2022"}</span>
            <span>No credit card</span>
            <span aria-hidden>{"\u2022"}</span>
            <span>Cancel anytime</span>
          </div>
        </div>

        <div className="glass absolute right-8 top-1/2 hidden h-[320px] w-[420px] -translate-y-1/2 rounded-2xl border border-white/10 p-6 lg:block">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <Users
                className="mx-auto mb-2 h-6 w-6 text-brand-blue"
                aria-hidden
              />
              <div className="text-xs text-gray-400">Employees</div>
              <div className="text-lg font-bold text-white">24</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <Clock
                className="mx-auto mb-2 h-6 w-6 text-brand-violet"
                aria-hidden
              />
              <div className="text-xs text-gray-400">Time Tracking</div>
              <div className="text-lg font-bold text-white">98%</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <Wallet
                className="mx-auto mb-2 h-6 w-6 text-brand-teal"
                aria-hidden
              />
              <div className="text-xs text-gray-400">Payroll</div>
              <div className="text-lg font-bold text-white">{"\u20AC"}42k</div>
            </div>
          </div>
          <div className="mt-4 flex h-16 items-end gap-1">
            {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-brand-blue to-brand-violet"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 2. FEATURES */}
      <section
        id="features"
        className="scroll-mt-20 border-b border-white/10 bg-navy-900 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">
              FEATURES
            </p>
            <h2 className="gradient-text mt-3 text-4xl font-bold md:text-5xl">
              Everything you need
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-400">
              Six core areas to run HR operations without spreadsheet chaos.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                icon: FileText,
                title: "Payroll",
                desc: "Generate payslips, calculate deductions, export PDF",
              },
              {
                icon: FolderOpen,
                title: "Documents",
                desc: "Store contracts, certificates, evaluations securely",
              },
              {
                icon: BarChart3,
                title: "Reports",
                desc: "Insightful reports on attendance, payroll, headcount",
              },
              {
                icon: Globe,
                title: "Multi-language",
                desc: "English and Romanian, more coming soon",
              },
            ].map((f, index) => (
              <Fragment key={f.title}>
                {index === 3 ? (
                  <div className="col-span-full my-8 h-px w-full max-w-md justify-self-center bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />
                ) : null}
                <div className="glass group rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:border-white/20 hover:shadow-card-hover">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/20 to-brand-violet/20 transition-transform duration-500 group-hover:rotate-3 group-hover:scale-110">
                    <f.icon className="h-6 w-6 text-brand-blue" aria-hidden />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="leading-relaxed text-gray-400">{f.desc}</p>
                  <div className="mt-6 h-0.5 w-0 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet transition-all duration-500 group-hover:w-full" />
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Product demo (Watch Demo target) */}
      <section
        id="demo"
        className="relative scroll-mt-20 border-b border-white/10 px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B1120]/50 to-transparent" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#00C9A7]">
              PRODUCT DEMO
            </span>
            <h2 className="gradient-text mt-4 text-4xl font-bold md:text-5xl">
              See VECTO in action
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              Watch how easy it is to manage your team, track attendance,
              process payroll and generate reports — all in one place.
            </p>
          </div>

          <VideoPlayer />

          <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { label: "Employee Management", desc: "Add, edit, track" },
              { label: "Time Tracking", desc: "Clock in/out" },
              { label: "Payslip Generation", desc: "Auto PDF/Excel" },
              { label: "Bank Export", desc: "One-click payment" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-4 text-center"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-sm font-semibold text-white">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-b border-white/10 bg-navy-900 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="gradient-text text-3xl font-bold md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-gray-400">
              Three steps from signup to daily HR workflows.
            </p>
          </div>
          <div className="relative mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="absolute left-[33%] top-[100px] hidden h-px w-1/6 bg-gradient-to-r from-brand-blue/50 to-brand-violet/50 md:block" />
            <div className="absolute right-[33%] top-[100px] hidden h-px w-1/6 bg-gradient-to-r from-brand-violet/50 to-brand-teal/50 md:block" />
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
                icon: BarChart3,
                title: "Start managing",
                text: "Track attendance, run payroll, export reports, and collaborate with your team.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="glass relative rounded-2xl p-8 text-center transition-all duration-500 hover:-translate-y-2 hover:shadow-card-hover"
              >
                <div className="mb-4 text-xs font-bold tracking-widest text-brand-teal">
                  STEP {s.step}
                </div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet shadow-glow-blue">
                  <s.icon className="h-9 w-9 text-white" aria-hidden />
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-3 text-gray-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PRICING */}
      <section
        id="pricing"
        className="scroll-mt-20 border-b border-white/10 bg-navy-900 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="gradient-text text-3xl font-bold md:text-4xl">
              Pricing
            </h2>
            <p className="mt-3 text-gray-400">
              {stripeCheckoutEnabled
                ? "Transparent plans. Start with a 14-day trial when you subscribe via Stripe."
                : "Transparent plans. Free registration with no online payment."}
            </p>
          </div>
          <PricingCards
            stripePriceIds={stripePriceIds}
            salesEmail={salesEmail}
            trialDays={trialDays}
            stripeCheckoutEnabled={stripeCheckoutEnabled}
          />
          <p className="mt-8 text-center text-xs text-gray-500">
            Need the full pricing page?{" "}
            <Link
              href={ROUTES.pricing}
              className="text-brand-blue hover:underline"
            >
              Open /pricing
            </Link>
          </p>
        </div>
      </section>

      {/* 5. TESTIMONIALS */}
      <section className="border-b border-white/10 bg-navy-900 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="gradient-text text-3xl font-bold md:text-4xl">
              What teams say
            </h2>
            <p className="mt-3 text-gray-400">Trusted by teams across Romania</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                name: "Alexandra Ionescu",
                role: "HR Director",
                company: "LogiTrans SRL",
                body: "We finally replaced scattered spreadsheets. Onboarding new hires is twice as fast.",
                initials: "AI",
                avatarClass:
                  "bg-gradient-to-br from-[#2D62FF] to-[#7B61FF]",
              },
              {
                name: "Michael Schmidt",
                role: "Operations Lead",
                company: "EuroBuild GmbH",
                body: "Payroll exports and document expiry alerts save us hours every week. Highly recommended.",
                initials: "MS",
                avatarClass:
                  "bg-gradient-to-br from-[#00C9A7] to-[#2D62FF]",
              },
              {
                name: "Elena Popa",
                role: "Founder",
                company: "TechNest",
                body: "Clean UI, Romanian and English in one place. Our distributed team actually uses it.",
                initials: "EP",
                avatarClass:
                  "bg-gradient-to-br from-[#7B61FF] to-[#00C9A7]",
              },
            ].map((item) => (
              <figure
                key={item.name}
                className="glass relative rounded-2xl p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span
                  className="absolute left-6 top-4 font-serif text-6xl text-brand-violet/20"
                  aria-hidden
                >
                  &quot;
                </span>
                <div className="mb-4 flex gap-1" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <blockquote className="relative leading-relaxed text-gray-300 italic">
                  &quot;{item.body}&quot;
                </blockquote>
                <div className="my-6 h-px w-12 bg-gradient-to-r from-brand-blue to-brand-violet" />
                <figcaption className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${item.avatarClass}`}
                  >
                    {item.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {item.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.role}, {item.company}
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section
        id="faq"
        className="scroll-mt-20 border-b border-white/10 bg-navy-900 py-16 md:py-24"
      >
        <div className="px-4">
          <h2 className="gradient-text text-center text-3xl font-bold md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-center text-gray-400">
            Quick answers about plans, trials, and data.
          </p>
          <div className="mx-auto mt-12 max-w-3xl">
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
            ].map((item, i) => (
              <div key={item.q} className="glass mb-3 overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => toggleFaqIndex(i)}
                  aria-expanded={openFaqIndex === i}
                  className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-white/5"
                >
                  <span className="text-lg font-medium text-white">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300",
                      openFaqIndex === i && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-500 ease-in-out",
                    openFaqIndex === i ? "max-h-96" : "max-h-0",
                  )}
                >
                  <div className="ml-6 border-l-2 border-brand-blue p-6 pt-0 leading-relaxed text-gray-400">
                    {item.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-900 via-[#0d1a3d] to-navy-900 py-24">
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-brand-violet/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-blue/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-violet/40 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="gradient-text text-4xl font-bold md:text-5xl">
            Ready to streamline your HR?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join teams that run payroll, documents, and attendance in one
            place.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-teal px-10 py-4 font-semibold text-white transition-all hover:-translate-y-1 hover:shadow-glow-blue"
          >
            Start Your 14-Day Free Trial
          </Link>
          <p className="mt-4 text-gray-500">No credit card required</p>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-white/10 bg-navy-900 pb-8 pt-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-xl font-bold tracking-wider text-white"
            >
              VECTO
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Modern HR software for employee records, attendance, payroll, and
              compliance documents. Built for clarity and scale.
            </p>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Product
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#features"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Politică confidențialitate
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Termeni și condiții
                </Link>
              </li>
              <li>
                <Link
                  href="/gdpr"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  Drepturi GDPR
                </Link>
              </li>
              <li>
                <Link
                  href="/dpa"
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  DPA
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Contact
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm text-gray-400 transition-colors hover:text-brand-blue"
            >
              {contactEmail}
            </a>
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/10 px-6 pt-8 md:flex-row">
          <p className="text-sm text-gray-600">
            &copy; 2025 HR Management. All rights reserved.
          </p>
          <a
            href="https://www.vecto.ro"
            className="text-sm text-brand-blue hover:underline"
          >
            www.vecto.ro
          </a>
        </div>
      </footer>
    </div>
  );
}
