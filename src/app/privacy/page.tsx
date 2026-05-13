import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | HR Management",
  description: "Privacy policy placeholder for HR Management.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-16 text-slate-800">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-blue-950 hover:underline"
        >
          &larr; Back to home
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-blue-950">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          This is a placeholder page. Replace this content with your privacy
          policy, data processing details, and contact information for data
          requests.
        </p>
      </div>
    </div>
  );
}
