import { prismaTyped as prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SetupWizard from "./setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  return <SetupWizard />;
}
