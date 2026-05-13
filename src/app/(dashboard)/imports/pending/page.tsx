import { ROUTES } from "../../../../lib/routes";
import { redirect } from "next/navigation";

export default function ImportsPendingAliasRedirect() {
  redirect(`${ROUTES.imports}?status=pending`);
}
