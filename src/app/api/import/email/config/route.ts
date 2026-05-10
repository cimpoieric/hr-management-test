/**
 * GET  /api/import/email/config  — Returnează config IMAP (fără password)
 * PUT  /api/import/email/config  — Salvează config IMAP (doar ADMIN)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";

// Keys pentru SystemConfig
const CONFIG_KEYS = {
  host: "IMAP_HOST",
  port: "IMAP_PORT",
  user: "IMAP_USER",
  password: "IMAP_PASSWORD",
  tls: "IMAP_TLS",
  cronMinutes: "IMAP_CRON_MINUTES",
};

/**
 * Returnează config IMAP fără password.
 */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    // Încearcă din DB (SystemConfig)
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [CONFIG_KEYS.host, CONFIG_KEYS.port, CONFIG_KEYS.user, CONFIG_KEYS.tls, CONFIG_KEYS.cronMinutes],
        },
      },
    });

    const dbValues: Record<string, string> = {};
    for (const c of configs) {
      dbValues[c.key] = c.value;
    }

    // Fallback la .env
    const result = {
      host: dbValues[CONFIG_KEYS.host] ?? process.env.IMAP_HOST ?? "",
      port: parseInt(dbValues[CONFIG_KEYS.port] ?? process.env.IMAP_PORT ?? "993", 10),
      user: dbValues[CONFIG_KEYS.user] ?? process.env.IMAP_USER ?? "",
      // Password NU e returnat niciodată
      tls: (dbValues[CONFIG_KEYS.tls] ?? process.env.IMAP_TLS ?? "true") === "true",
      cronMinutes: parseInt(dbValues[CONFIG_KEYS.cronMinutes] ?? "15", 10),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[EMAIL_CONFIG_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

/**
 * Salvează config IMAP. Doar ADMIN.
 * Testează conexiunea înainte de salvare.
 */
export async function PUT(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

  try {
    const body = await request.json();
    const { host, port, user: imapUser, password, tls, cronMinutes } = body;

    if (!host || !imapUser) {
      return NextResponse.json(
        { error: "Host și user sunt obligatorii" },
        { status: 400 }
      );
    }

    // Test conexiune (doar dacă e furnizat password)
    if (password) {
      try {
        const { ImapFlow } = await import("imapflow");
        const testClient = new ImapFlow({
          host,
          port: port ?? 993,
          secure: tls !== false,
          auth: { user: imapUser, pass: password },
          logger: false,
          connectionTimeout: 15_000,
        });
        await testClient.connect();
        await testClient.logout();
      } catch {
        return NextResponse.json(
          { error: "Test conexiune eșuat. Verifică host, port, user și parola." },
          { status: 400 }
        );
      }
    }

    // Salvează în DB
    const entries = [
      { key: CONFIG_KEYS.host, value: host },
      { key: CONFIG_KEYS.port, value: String(port ?? 993) },
      { key: CONFIG_KEYS.user, value: imapUser },
      { key: CONFIG_KEYS.tls, value: String(tls !== false) },
      { key: CONFIG_KEYS.cronMinutes, value: String(cronMinutes ?? 15) },
    ];

    // Salvează password doar dacă e furnizat
    if (password) {
      entries.push({ key: CONFIG_KEYS.password, value: password });
    }

    for (const entry of entries) {
      await prisma.systemConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: { key: entry.key, value: entry.value },
      });
    }

    return NextResponse.json({ message: "Configurație salvată" }, { status: 200 });
  } catch (error) {
    console.error("[EMAIL_CONFIG_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
