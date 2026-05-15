"use client";

import { Download, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type DocumentPreviewModalDocument = {
  id: number;
  fileName: string;
  mimeType: string;
  /** URL API (ex. /api/documents/1/file) — încărcat cu credentials, apoi afișat ca blob. */
  url: string;
  downloadUrl?: string;
  employee?: { firstName: string; lastName: string } | null;
};

type DocumentPreviewModalProps = {
  document: DocumentPreviewModalDocument | null;
  onClose: () => void;
};

function isPdf(doc: DocumentPreviewModalDocument): boolean {
  if (doc.mimeType === "application/pdf") return true;
  return /\.pdf$/i.test(doc.fileName);
}

function isPreviewableImage(doc: DocumentPreviewModalDocument): boolean {
  const mime = doc.mimeType.toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(doc.fileName);
}

function employeeLabel(doc: DocumentPreviewModalDocument): string {
  const e = doc.employee;
  if (!e) return "—";
  const a = `${e.lastName} ${e.firstName}`.trim();
  return a.length > 0 ? a : "—";
}

function revokeRefUrl(ref: { current: string | null }): void {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = null;
  }
}

export function DocumentPreviewModal({
  document: doc,
  onClose,
}: DocumentPreviewModalProps) {
  const [assetLoaded, setAssetLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** URL blob pentru <img> / <iframe> (fetch cu cookie httpOnly). */
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const needsAssetLoader =
    doc != null && (isPdf(doc) || isPreviewableImage(doc));

  useEffect(() => {
    revokeRefUrl(blobUrlRef);
    setPreviewSrc(null);

    if (!doc) {
      setAssetLoaded(false);
      setLoadError(null);
      return;
    }

    setLoadError(null);

    if (!isPdf(doc) && !isPreviewableImage(doc)) {
      setAssetLoaded(true);
      return;
    }

    setAssetLoaded(false);

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(doc.url, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!cancelled) {
            setLoadError(data.error ?? `Eroare la încărcare (${res.status})`);
            setAssetLoaded(true);
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        revokeRefUrl(blobUrlRef);
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setPreviewSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setLoadError("Eroare de rețea la încărcarea previzualizării.");
          setAssetLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    return () => {
      revokeRefUrl(blobUrlRef);
    };
  }, []);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    const url = doc.downloadUrl ?? `/api/documents/${doc.id}/download`;
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Eroare la descărcare");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.fileName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Eroare de rețea");
    }
  }, [doc]);

  if (!doc) return null;

  const showSpinner =
    needsAssetLoader && (!previewSrc || (!assetLoaded && !loadError));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2
              id="document-preview-title"
              className="truncate text-sm font-semibold text-gray-900"
            >
              {doc.fileName}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Angajat:{" "}
              <span className="text-gray-700">{employeeLabel(doc)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title="Închide"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative min-h-[320px] flex-1 overflow-auto bg-gray-50 p-3">
          {showSpinner && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px]"
              aria-busy="true"
              aria-live="polite"
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">
                Se încarcă fișierul…
              </span>
            </div>
          )}

          {loadError && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-red-600">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Download size={16} />
                Descărcare
              </button>
            </div>
          )}

          {!loadError && previewSrc != null && isPreviewableImage(doc) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={doc.fileName}
              className="mx-auto max-h-[70vh] max-w-full object-contain"
              onLoad={() => {
                setAssetLoaded(true);
                setLoadError(null);
              }}
              onError={() => {
                setAssetLoaded(true);
                setLoadError(
                  "Nu s-a putut încărca imaginea. Încercați descărcarea.",
                );
              }}
            />
          )}

          {!loadError && previewSrc != null && isPdf(doc) && (
            <iframe
              src={previewSrc}
              width="100%"
              height={500}
              className="w-full rounded border-0 bg-white"
              title={doc.fileName}
              onLoad={() => {
                setAssetLoaded(true);
                setLoadError(null);
              }}
              onError={() => {
                setAssetLoaded(true);
                setLoadError(
                  "Nu s-a putut încărca PDF-ul. Încercați descărcarea.",
                );
              }}
            />
          )}

          {!loadError && !isPdf(doc) && !isPreviewableImage(doc) && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="max-w-md text-sm text-gray-600">
                Descărcați fișierul pentru vizualizare.
              </p>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Download size={16} />
                Descărcare
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
