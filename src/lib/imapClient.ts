import "server-only";

/**
 * Client IMAP — imapflow (API v1.x).
 * UNSEEN: căutare cu { seen: false }; conținut parte via download().
 */

import type { Readable } from "stream";
import { ImapFlow, type MessageStructureObject } from "imapflow";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface EmailMessage {
  uid: number;
  subject: string;
  from: { address: string; name: string };
  date: Date;
  bodyText: string;
  attachments: EmailAttachment[];
}

function getConfig() {
  return {
    host: process.env.IMAP_HOST ?? "",
    port: Number.parseInt(process.env.IMAP_PORT ?? "993", 10),
    secure: process.env.IMAP_TLS !== "false",
    user: process.env.IMAP_USER ?? "",
    password: process.env.IMAP_PASSWORD ?? "",
  };
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function collectLeafParts(
  node: MessageStructureObject | undefined,
  out: MessageStructureObject[],
): void {
  if (!node) return;
  if (node.childNodes?.length) {
    for (const ch of node.childNodes) {
      collectLeafParts(ch, out);
    }
  } else if (node.part) {
    out.push(node);
  }
}

export async function connectToIMAP(): Promise<ImapFlow> {
  const config = getConfig();

  if (!config.host || !config.user || !config.password) {
    throw new Error(
      "Config IMAP incomplet. Setează IMAP_HOST, IMAP_USER, IMAP_PASSWORD în .env",
    );
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
  });

  await client.connect();
  return client;
}

export async function fetchUnreadEmails(): Promise<EmailMessage[]> {
  const client = await connectToIMAP();
  const messages: EmailMessage[] = [];

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids: number[] = Array.isArray(searchResult)
        ? searchResult.slice(0, 50)
        : [];

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(
            String(uid),
            {
              uid: true,
              envelope: true,
              bodyStructure: true,
            },
            { uid: true },
          );

          if (msg === false || !msg.uid) continue;

          const subject = msg.envelope?.subject ?? "(fără subiect)";
          const fromAddr = msg.envelope?.from?.[0]?.address ?? "unknown";
          const fromName = msg.envelope?.from?.[0]?.name ?? "";
          const date = msg.envelope?.date
            ? new Date(msg.envelope.date)
            : new Date();

          let bodyText = "";
          const attachments: EmailAttachment[] = [];

          if (msg.bodyStructure) {
            const leaves: MessageStructureObject[] = [];
            collectLeafParts(msg.bodyStructure, leaves);

            for (const leaf of leaves) {
              if (!leaf.part) continue;
              const ct = (leaf.type ?? "").toLowerCase();

              if (ct.startsWith("text/plain")) {
                try {
                  const dl = await client.download(String(uid), leaf.part, {
                    uid: true,
                  });
                  bodyText = (await readableToBuffer(dl.content)).toString(
                    "utf-8",
                  );
                } catch {
                  /* ignore */
                }
              }
            }

            for (let i = 0; i < leaves.length; i++) {
              const leaf = leaves[i];
              if (!leaf?.part) continue;
              const ct = (leaf.type ?? "").toLowerCase();
              const isAttachment =
                leaf.disposition === "attachment" ||
                ct === "application/pdf" ||
                ct.startsWith("image/");

              if (!isAttachment) continue;

              try {
                const dl = await client.download(String(uid), leaf.part, {
                  uid: true,
                });
                const buf = await readableToBuffer(dl.content);
                const filename =
                  leaf.dispositionParameters?.filename ??
                  leaf.parameters?.name ??
                  dl.meta.filename ??
                  `attachment_${i}`;

                attachments.push({
                  filename,
                  contentType: ct || "application/octet-stream",
                  size: buf.length,
                  content: buf,
                });
                if (attachments.length >= 10) break;
              } catch {
                /* ignore */
              }
            }
          }

          messages.push({
            uid: msg.uid,
            subject: subject.startsWith("=?")
              ? decodeMimeSubject(subject)
              : subject,
            from: { address: fromAddr, name: fromName },
            date,
            bodyText,
            attachments,
          });
        } catch (msgError) {
          console.error(`[IMAP] Eroare la procesarea UID ${uid}:`, msgError);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export async function markAsSeen(uid: number): Promise<void> {
  const client = await connectToIMAP();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd({ uid: uid.toString() }, ["\\Seen"], {
        uid: true,
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function decodeMimeSubject(subject: string): string {
  try {
    return subject
      .replace(
        /=\?([\w-]+)\?([BQ])\?([^?]+)\?=/gi,
        (_match, _charset, encoding, text) => {
          if (encoding.toUpperCase() === "B") {
            return Buffer.from(text, "base64").toString("utf-8");
          }
          return text.replace(/=/g, "%");
        },
      )
      .replace(/%3D/g, "=")
      .replace(/%20/g, " ");
  } catch {
    return subject;
  }
}
