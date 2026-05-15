import "server-only";

import { NextResponse } from "next/server";

/** True when running inside the packaged/desktop Electron app (never on Vercel). */
export function isElectronDesktopMode(): boolean {
  if (process.env.VERCEL === "1") {
    return false;
  }

  const mode = process.env.ELECTRON_MODE?.trim().toLowerCase();
  if (mode === "true" || mode === "1") {
    return true;
  }

  const run = process.env.ELECTRON_RUN?.trim().toLowerCase();
  return run === "1" || run === "true";
}

/** Blocks web/Vercel access to desktop-only SQLite file APIs. */
export function electronDesktopOnlyResponse(
  message = "Aceasta functie este disponibila doar in aplicatia desktop.",
): NextResponse | null {
  if (isElectronDesktopMode()) {
    return null;
  }

  return NextResponse.json({ error: message }, { status: 403 });
}
