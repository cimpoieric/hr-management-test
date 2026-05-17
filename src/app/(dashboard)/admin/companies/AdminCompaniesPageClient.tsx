"use client";

import { AdminOrganizationsPanel } from "@/components/admin/AdminOrganizationsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SuperAdminAddOrganizationButton } from "@/components/admin/SuperAdminAddOrganizationButton";

export default function AdminCompaniesPageClient() {
  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminPageHeader
          title="Companies"
          description="All organizations registered on the platform."
        />
        <SuperAdminAddOrganizationButton className="self-start" />
      </div>
      <AdminOrganizationsPanel showFilters />
    </div>
  );
}
