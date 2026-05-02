"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, FileImage, X, AlertCircle, Loader2 } from "lucide-react";

export default function ImportManualPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError("");
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
    }
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress("Se încarcă fișierul...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress("Se extrage textul din document...");

      const res = await fetch("/api/import/manual", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Eroare la procesare");
        setUploading(false);
        return;
      }

      setProgress("Redirecționare...");
      router.push(`/importuri/${data.id}`);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
      setUploading(false);
    }
  }

  const isImage = file?.type.startsWith("image/");
  const isPDF = file?.type === "application/pdf";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Import manual document
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Încarcă un PDF sau o poză — sistemul extrage datele automat
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          uploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : dragActive
            ? "border-slate-900 bg-slate-50 scale-[1.01]"
            : file
            ? "border-green-300 bg-green-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2 size={40} className="mx-auto text-slate-900 animate-spin" />
            <p className="font-medium text-gray-900">{progress}</p>
            <p className="text-xs text-gray-400">
              OCR poate dura până la 60 de secunde pentru imagini mari
            </p>
          </div>
        ) : file ? (
          <div className="space-y-3">
            {isImage ? (
              <FileImage size={40} className="mx-auto text-green-600" />
            ) : (
              <FileText size={40} className="mx-auto text-green-600" />
            )}
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {formatBytes(file.size)} · {isPDF ? "PDF" : isImage ? "Imagine" : "Fișier"}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <X size={14} />
              Elimină
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={40} className="mx-auto text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">
                Trage fișierul aici sau click pentru a selecta
              </p>
              <p className="text-sm text-gray-400 mt-1">
                PDF, JPG, PNG — maxim 50MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Eroare */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Buton upload */}
      {file && !uploading && (
        <button
          onClick={handleUpload}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
        >
          Analizează documentul
        </button>
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Extragerea este heuristică</p>
        <p className="text-amber-700">
          Sistemul încearcă să detecteze automat CNP, nume, IBAN, telefon, email.
          Verifică întotdeauna datele extrase înainte de a salva. Pentru documente
          scanate de calitate slabă, OCR poate produce erori.
        </p>
      </div>
    </div>
  );
}
