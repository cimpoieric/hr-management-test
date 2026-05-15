import "server-only";

/**
 * Angajati marcati ca detasati in profil (import W18, CIM) fara rand Deployment.
 */

export function isEmployeeMarkedDetached(emp: {
  workNorm?: string | null;
  position?: string | null;
  observations?: string | null;
}): boolean {
  const wn = String(emp.workNorm ?? "").toLowerCase();
  if (wn.includes("detas")) return true;
  const pos = String(emp.position ?? "").toLowerCase();
  if (pos.includes("detas")) return true;
  const obs = String(emp.observations ?? "").toLowerCase();
  if (
    obs.includes("contracttype=detasare") ||
    obs.includes("contracttype=detached") ||
    (obs.includes("detasare") && obs.includes("contract"))
  ) {
    return true;
  }
  return false;
}

export const detachedEmployeeProfileWhere = {
  OR: [
    { workNorm: { contains: "detas", mode: "insensitive" as const } },
    { position: { contains: "detas", mode: "insensitive" as const } },
    { observations: { contains: "detasare", mode: "insensitive" as const } },
  ],
};

export function resolveDeploymentCountryCode(
  countryCode: string | null | undefined,
): string {
  const c = String(countryCode ?? "")
    .trim()
    .toUpperCase();
  if (c.length === 2) return c;
  return "NL";
}
