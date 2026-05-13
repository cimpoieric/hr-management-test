import "server-only";

/**
 * Cron intern pentru import automat de emailuri.
 *
 * Folosește setInterval nativ (nu node-cron) pentru simplitate
 * și compatibilitate maximă.
 *
 * Loghează în consolă și în fișier.
 */

import path from "path";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { processEmail } from "./emailProcessor";
import { fetchUnreadEmails } from "./imapClient";

const LOG_DIR = "./data/logs";
const LOG_FILE = path.join(LOG_DIR, "cron-import.log");

// Stare globală
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;
let totalProcessedToday = 0;
let lastError: string | null = null;

/**
 * Scrie log într-un fișier rotativ.
 */
async function writeLog(level: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;

  // Console: doar erori (restul e în fișier)
  if (level === "ERROR") {
    console.error(line.trim());
  }

  // Fișier
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line);
  } catch {
    // Ignoră erori de scriere log
  }
}

/**
 * O singură rundă de procesare emailuri.
 */
async function runImportRound(): Promise<{
  processed: number;
  created: number;
  errors: string[];
}> {
  if (isRunning) {
    return {
      processed: 0,
      created: 0,
      errors: ["Runda anterioară încă în desfășurare"],
    };
  }

  isRunning = true;
  lastRunAt = new Date();
  const errors: string[] = [];
  let processed = 0;
  let created = 0;

  try {
    await writeLog("INFO", "=== Runda de import email începută ===");

    // 1. Verifică config IMAP
    if (
      !process.env.IMAP_HOST ||
      !process.env.IMAP_USER ||
      !process.env.IMAP_PASSWORD
    ) {
      const msg = "Config IMAP lipsă — sare peste rundă";
      await writeLog("WARN", msg);
      lastError = msg;
      return { processed: 0, created: 0, errors: [msg] };
    }

    // 2. Fetch emailuri necitite
    let messages;
    try {
      messages = await fetchUnreadEmails();
    } catch (fetchError) {
      const msg = `Eroare conexiune IMAP: ${fetchError instanceof Error ? fetchError.message : "necunoscută"}`;
      await writeLog("ERROR", msg);
      lastError = msg;
      return { processed: 0, created: 0, errors: [msg] };
    }

    if (messages.length === 0) {
      await writeLog("INFO", "Niciun email nou");
      return { processed: 0, created: 0, errors: [] };
    }

    await writeLog("INFO", `${messages.length} emailuri necitite găsite`);

    // 3. Procesează fiecare email
    for (const message of messages) {
      try {
        const result = await processEmail(message);
        processed++;
        created += result.pendingImports;

        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }

        await writeLog(
          "INFO",
          `Email "${message.subject}" — ${result.pendingImports} importuri create`,
        );
      } catch (processError) {
        const msg = `Eroare procesare "${message.subject}": ${
          processError instanceof Error ? processError.message : "?"
        }`;
        await writeLog("ERROR", msg);
        errors.push(msg);
      }
    }

    totalProcessedToday += created;
    lastError = null;

    await writeLog(
      "INFO",
      `=== Runda finalizată: ${processed} emailuri, ${created} importuri create ===`,
    );
  } catch (error) {
    const msg = `Eroare critică în rundă: ${error instanceof Error ? error.message : "?"}`;
    await writeLog("ERROR", msg);
    lastError = msg;
    errors.push(msg);
  } finally {
    isRunning = false;
  }

  return { processed, created, errors };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pornește cron-ul intern.
 * Interval: 15 minute (900.000 ms).
 */
export function startEmailImportCron(): void {
  if (intervalId) {
    void writeLog("WARN", "[CRON] Deja pornit");
    return;
  }

  // Rulează imediat la startup
  runImportRound().catch(console.error);

  // Apoi la fiecare 15 minute
  intervalId = setInterval(
    () => {
      runImportRound().catch(console.error);
    },
    15 * 60 * 1000,
  ); // 15 minute

  void writeLog("INFO", "[CRON] Email import cron pornit — interval 15 minute");
}

/**
 * Oprește cron-ul.
 */
export function stopEmailImportCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    void writeLog("INFO", "[CRON] Email import cron oprit");
  }
}

/**
 * Declanșează manual o rundă.
 */
export async function triggerManualImport(): ReturnType<typeof runImportRound> {
  return runImportRound();
}

/**
 * Returnează statusul curent al cron-ului.
 */
export function getCronStatus(): {
  running: boolean;
  lastRunAt: string | null;
  totalProcessedToday: number;
  lastError: string | null;
  intervalMinutes: number;
} {
  return {
    running: intervalId !== null,
    lastRunAt: lastRunAt?.toISOString() ?? null,
    totalProcessedToday,
    lastError,
    intervalMinutes: 15,
  };
}

/**
 * Resetează contorul zilnic (apelează la miezul nopții sau manual).
 */
export function resetDailyCounter(): void {
  totalProcessedToday = 0;
}
