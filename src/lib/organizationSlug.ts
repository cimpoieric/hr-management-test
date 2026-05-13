import "server-only";

import { prismaBase } from "@/lib/prisma";

/** Lowercase slug from company name (a-z, 0-9, hyphens). */
export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "organization";
}

export async function resolveUniqueOrganizationSlug(
  name: string,
): Promise<string> {
  let base = slugifyOrganizationName(name);
  if (!base) base = "organization";
  let candidate = base;
  let suffix = 0;
  while (
    await prismaBase.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
    if (suffix > 500) {
      candidate = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return candidate;
}
