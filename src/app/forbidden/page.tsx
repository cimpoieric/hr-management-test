import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export const metadata = {
  title: "Acces interzis | HR Management",
};

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
        403
      </p>
      <h1 className="text-2xl font-semibold text-slate-900">Acces interzis</h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        Nu ai permisiunea necesara pentru aceasta pagina sau actiune. Contacteaza
        administratorul organizatiei daca consideri ca este o greseala.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.dashboard}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tablou de bord
        </Link>
        <Link
          href={ROUTES.pricing}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Planuri si preturi
        </Link>
      </div>
    </div>
  );
}
