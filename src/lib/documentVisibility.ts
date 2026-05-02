import type { Prisma } from "@prisma/client";

/** Documente vizibile (neșterse soft). Folosit în toate query-urile de listă / citire. */
export function documentsWhereVisible(
  base: Prisma.DocumentWhereInput = {}
): Prisma.DocumentWhereInput {
  const hasKeys = Object.keys(base).length > 0;
  if (!hasKeys) {
    return { deletedAt: null };
  }
  return { AND: [base, { deletedAt: null }] };
}
