import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function ImporturiInAsteptareIdLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`${ROUTES.imports}/${id}`);
}
