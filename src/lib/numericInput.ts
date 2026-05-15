import type { WheelEvent } from "react";

/**
 * Prevents mouse wheel from changing a focused number input (common accidental edit).
 */
export function preventWheelOnFocusedNumberInput(
  e: WheelEvent<HTMLInputElement>,
): void {
  if (document.activeElement === e.currentTarget) {
    e.preventDefault();
  }
}

/**
 * Parse user-typed decimal text; returns null when empty or invalid.
 */
export function parseOptionalDecimalInput(raw: string): number | null {
  const s = raw.replace(",", ".").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Integer parser for optional empty input.
 */
export function parseOptionalIntInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
