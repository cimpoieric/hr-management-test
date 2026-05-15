import { redirect } from "next/navigation";

/** Alias /superadmin -> panou global (aceea?i zon? ca /admin). */
export default function SuperAdminPage() {
  redirect("/admin");
}
