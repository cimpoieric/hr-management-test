import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        {"Pagina nu a fost g\u0103sit\u0103"}
      </h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        {"URL-ul solicitat nu exist\u0103 sau a fost mutat."}
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
      >
        {"\u00cenapoi la pagina principal\u0103"}
      </Link>
    </div>
  );
}
