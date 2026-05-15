/**
 * Fuzzy match country display name (CIM text) to Country row id.
 */

export function foldDiacritics(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function matchCountryId(
  text: string,
  countries: ReadonlyArray<{ id: number; name: string }>,
): number | null {
  const raw = text.trim();
  if (!raw) return null;
  const t = foldDiacritics(raw);
  let best: { id: number; len: number } | null = null;
  for (const c of countries) {
    const cn = foldDiacritics(c.name);
    if (cn === t) return c.id;
    if (cn.includes(t) || t.includes(cn)) {
      const len = Math.min(cn.length, t.length);
      if (!best || len > best.len) best = { id: c.id, len };
    }
  }
  return best?.id ?? null;
}
