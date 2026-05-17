"use client";

import { AdminOrganizationsPanel } from "@/components/admin/AdminOrganizationsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminCompaniesPageClient() {
  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminPageHeader
          title="Companies"
          description="All organizations registered on the platform."
        />
        <Button asChild className="shrink-0 self-start">
          <Link href="/admin/organizations/create">Adauga organizatie</Link>
        </Button>
      </div>
      <AdminOrganizationsPanel showFilters />
    </div>
  );
}
