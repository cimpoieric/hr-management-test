import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | HR Management",
  description: "Terms of service placeholder for HR Management.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-16 text-slate-800">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-blue-950 hover:underline"
        >
          &larr; Back to home
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-blue-950">
          Terms of service
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          This is a placeholder page. Replace this content with your terms of
          use, acceptable use policy, and liability limitations.
        </p>
      </div>
    </div>
  );
}
