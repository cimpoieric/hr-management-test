"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ro">
      <body className="min-h-dvh bg-slate-50 antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
            500
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Eroare interna
          </h1>
          <p className="max-w-md text-center text-sm text-slate-600">
            A aparut o problema neasteptata. Incearca din nou sau revino mai
            tarziu.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Incearca din nou
          </button>
        </div>
      </body>
    </html>
  );
}
