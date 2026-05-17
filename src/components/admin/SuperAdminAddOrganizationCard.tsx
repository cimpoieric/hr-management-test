"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/lib/roles";
import { Building2, Plus, Shield } from "lucide-react";
import Link from "next/link";

const CREATE_ORG_HREF = "/admin/organizations/create";

/** Card evident pentru creare organizatie - vizibil doar pentru SUPER_ADMIN. */
export function SuperAdminAddOrganizationCard() {
  const { role } = useAuth();

  if (role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  return (
    <section
      className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 shadow-sm ring-1 ring-violet-100"
      aria-labelledby="super-admin-platform-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h2
              id="super-admin-platform-heading"
              className="text-lg font-semibold text-violet-950"
            >
              Administrare platforma
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Creeaza manual o firma client noua, cont administrator HR si plan
              de abonament.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="w-full shrink-0 bg-violet-700 text-white hover:bg-violet-800 sm:w-auto"
        >
          <Link href={CREATE_ORG_HREF}>
            <Plus className="mr-2 h-5 w-5" aria-hidden />
            Creeaza firma client
          </Link>
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-violet-800/80">
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        Super Admin - creare manuala organizatii
      </p>
    </section>
  );
}
