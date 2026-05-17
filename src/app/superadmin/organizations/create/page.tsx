import { redirect } from "next/navigation";

/** Alias: /superadmin/organizations/create -> panou admin. */
export default function SuperAdminCreateOrganizationPage() {
  redirect("/admin/organizations/create");
}
