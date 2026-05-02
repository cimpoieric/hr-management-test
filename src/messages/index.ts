import ro from "./ro.json";

export { ro };

export type RoMessages = typeof ro;

/** Etichete acțiuni audit (chei API neschimbate). */
export function tAuditAction(action: string): string {
  const actions = ro.audit.actions as Record<string, string>;
  return actions[action] ?? action.replace(/_/g, " ");
}

/** Etichete entități audit (nume model / API). */
export function tAuditEntity(entity: string): string {
  const entities = ro.audit.entities as Record<string, string>;
  return entities[entity] ?? entity;
}

/** Linie secundară activitate: entitate + id + utilizator. */
export function formatAuditActivityDetail(
  entity: string,
  entityId: number | null | undefined,
  userName: string | null | undefined
): string {
  const e = tAuditEntity(entity);
  const idPart = entityId != null && entityId !== undefined ? ` #${entityId}` : "";
  const userPart = userName ? ` · ${userName}` : "";
  return `${e}${idPart}${userPart}`;
}

/** Status document (VALID, PENDING, …). */
export function tDocumentStatus(code: string): string {
  const m = ro.documents.status as Record<string, string>;
  return m[code] ?? code;
}

/** Status import în așteptare. */
export function tImportStatus(code: string): string {
  const m = ro.import.status as Record<string, string>;
  return m[code] ?? code;
}
