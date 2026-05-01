"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle, FileImage } from "lucide-react";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { calculateStatus } from "@/lib/documentStatus";

interface DocumentUploadProps {
  employeeId: number;
  onSuccess?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract de muncă",
  ID: "Act identitate",
  MEDICAL: "Certificat medical",
  A1: "Formular A1",
  AUTHORIZATION: "Autorizație",
  VISA: "Viză",
  OTHER: "Alt document",
};

export function DocumentUpload({ employeeId, onSuccess }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("CONTRACT");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewStatus = expiryDate
    ? calculateStatus(new Date(expiryDate))
    : "PENDING";

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employeeId", String(employeeId));
      formData.append("type", type);
      if (number) formData.append("number", number);
      if (issueDate) formData.append("issueDate", issueDate);
      if (expiryDate) formData.append("expiryDate", expiryDate);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: `Document „${data.fileName}" încărcat cu succes` });
        setFile(null);
        setNumber("");
        setIssueDate("");
        setExpiryDate("");
        if (inputRef.current) inputRef.current.value = "";
        onSuccess?.();
      } else {
        setResult({ success: false, message: data.error ?? "Eroare la upload" });
      }
    } catch {
      setResult({ success: false, message: "Eroare de rețea" });
    } finally {
      setUploading(false);
    }
  }

  const isImage = file?.type.startsWith("image/");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-slate-900 bg-slate-50"
            : "border-gray-300 hover:border-gray-400"
        } ${file ? "bg-green-50 border-green-300" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            {isImage ? (
              <FileImage size={24} className="text-green-600" />
            ) : (
              <FileText size={24} className="text-green-600" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="p-1 rounded text-gray-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">
              Drag & drop sau click pentru a selecta
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, JPG, PNG — maxim 50MB
            </p>
          </>
        )}
      </div>

      {/* Form fields */}
      {file && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white rounded-xl border p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tip document *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Număr document
            </label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: 123/2024"
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data emitere
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data expirare
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          {expiryDate && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Status previzualizat:</span>
              <DocumentStatusBadge status={previewStatus} />
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {file && (
        <button
          type="submit"
          disabled={uploading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Se încarcă..." : "Încarcă document"}
        </button>
      )}

      {/* Result */}
      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.success ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {result.message}
        </div>
      )}
    </form>
  );
}
