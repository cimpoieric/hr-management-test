import { redirect } from "next/navigation";

/** Alias: /superadmin/users -> /admin/users */
export default function SuperAdminUsersPage() {
  redirect("/admin/users");
}
