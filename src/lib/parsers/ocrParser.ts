import "server-only";

/**
 * Parser OCR — extrage text din imagini folosind Tesseract.js.
 *
 * Timeout: 60 secunde.
 * Limbi: rum (română) + eng (engleză).
 * Returnează text + scor mediu de încredere.
 */

import { createWorker, type Worker } from "tesseract.js";

const OCR_TIMEOUT_MS = 60_000;

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Extrage text din imagine (Buffer) via Tesseract.js.
 * Creează un worker, recunoaște, termină worker-ul.
 */
export async function extractTextFromImage(buffer: Buffer): Promise<OcrResult> {
  let worker: Worker | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("OCR timeout — procesarea imaginii a durat prea mult (>60s)")), OCR_TIMEOUT_MS);
  });

  const ocrPromise = (async () => {
    try {
      worker = await createWorker("rum+eng", 1, {
        // logger: (m) => console.log(m), // decomentează pentru debug
      });

      const {
        data: { text, confidence },
      } = await worker.recognize(buffer);

      return { text: text ?? "", confidence };
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore terminate errors
        }
      }
    }
  })();

  return Promise.race([ocrPromise, timeoutPromise]);
}
