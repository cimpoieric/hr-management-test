/**
 * Trimite un email de test (Resend sau SMTP din .env).
 *
 * Usage:
 *   npx tsx scripts/test-email-send.ts you@example.com
 */

import "dotenv/config";
import {
  getActiveEmailProvider,
  sendTransactionalEmail,
} from "../src/lib/mail/transactional";

async function main() {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error("Usage: npx tsx scripts/test-email-send.ts <recipient@email.com>");
    process.exit(1);
  }

  const provider = getActiveEmailProvider();
  if (!provider) {
    console.error(
      "No email provider: set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.",
    );
    process.exit(1);
  }

  console.log("Provider:", provider);

  const result = await sendTransactionalEmail({
    to,
    subject: "HR Management — test email",
    html: "<p>Test email from HR Management. If you received this, email delivery works.</p>",
    text: "Test email from HR Management. If you received this, email delivery works.",
  });

  console.log("Sent OK:", result);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
