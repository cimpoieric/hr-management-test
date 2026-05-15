"use client";

import { AdminNav } from "@/components/admin/AdminNav";
import { AdminOrganizationsPanel } from "@/components/admin/AdminOrganizationsPanel";
import { AdminStatsDashboard } from "@/components/admin/AdminStatsDashboard";

export default function GlobalAdminPageClient() {
  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Global administration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Platform overview and organization management.
          </p>
        </div>
        <AdminNav />
      </div>

      <AdminStatsDashboard />

      <AdminOrganizationsPanel
        enableExpand
        actionStyle="labels"
        tableVariant="global"
      />
    </div>
  );
}
