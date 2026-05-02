import { prisma } from "@/lib/prisma";

/** Importuri cu status PENDING — același criteriu ca panoul de control. */
export async function getPendingImportsCount(): Promise<number> {
  return prisma.pendingImport.count({ where: { status: "PENDING" } });
}
