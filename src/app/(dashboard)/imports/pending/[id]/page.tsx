import { ROUTES } from "../../../../../lib/routes";
import { redirect } from "next/navigation";

export default async function ImporturiInAsteptareIdLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`${ROUTES.imports}/${id}`);
}
