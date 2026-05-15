"use client";

import { AdminOrganizationsPanel } from "@/components/admin/AdminOrganizationsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function AdminCompaniesPageClient() {
  return (
    <div className="max-w-7xl space-y-6">
      <AdminPageHeader
        title="Companies"
        description="All organizations registered on the platform."
      />
      <AdminOrganizationsPanel showFilters />
    </div>
  );
}
