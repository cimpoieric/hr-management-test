"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Settings,
  Upload,
  Image,
  AlertCircle,
  Check,
  Loader2,
  Trash2,
  Info,
} from "lucide-react";

export default function SetariPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoExists, setLogoExists] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if logo exists
  const checkLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo");
      if (res.ok) {
        const data = await res.json();
        setLogoExists(data.exists);
        if (data.exists && data.url) {
          setLogoUrl(data.url);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkLogo();
  }, [checkLogo]);

  async function handleUpload(file: File) {
    setUploading(true);
    setMessage("");
    setError("");

    try {
      // Validate
      if (!file.type.startsWith("image/")) {
        setError("Fișierul trebuie să fie imagine (PNG, JPG)");
        setUploading(false);
        return;
      }
      if (file.size > 500 * 1024) {
        setError("Dimensiune maximă: 500KB");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Eroare la upload");
        setUploading(false);
        return;
      }

      setMessage("Logo încărcat cu succes!");
      checkLogo();
    } catch {
      setError("Eroare la upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Ești sigur că vrei să ștergi logo-ul?")) return;

    try {
      const res = await fetch("/api/settings/logo", { method: "DELETE" });
      if (res.ok) {
        setMessage("Logo șters");
        setLogoExists(false);
        setLogoUrl(null);
      } else {
        setError("Eroare la ștergere");
      }
    } catch {
      setError("Eroare la ștergere");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setări</h1>
          <p className="text-sm text-gray-500">
            Configurare sistem — logo, parametri, notificări
          </p>
        </div>
      </div>

      {/* Logo Settings */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Image size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Logo firmă</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Logo-ul apare în header-ul tuturor rapoartelor PDF generate.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview current logo */}
          {logoExists && logoUrl && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <img
                src={logoUrl}
                alt="Logo curent"
                className="h-16 object-contain"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Logo curent</p>
                <p className="text-xs text-gray-500">
                  Acest logo va apărea în toate rapoartele PDF.
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                title="Șterge logo"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Upload area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
              className="hidden"
            />

            {uploading ? (
              <Loader2 size={32} className="mx-auto text-blue-500 animate-spin mb-3" />
            ) : (
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            )}

            <p className="text-sm font-medium text-gray-700">
              {uploading ? "Se încarcă..." : "Click sau drag & drop pentru upload"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG sau JPG, maxim 500KB, recomandat 200x60px
            </p>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Dacă nu este setat un logo, rapoartele vor afișa textul "HR Manager"
              în header. Logo-ul este stocat local și nu părăsește serverul.
            </p>
          </div>

          {/* Messages */}
          {message && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
              <Check size={14} />
              {message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Report Settings */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Setări rapoarte</h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-700">
                Validitate rapoarte
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Rapoartele generate sunt valabile 24 ore, apoi sunt șterse automat.
              </p>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              24 ore
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-700">
                Limită angajați per raport
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Maxim 5000 de angajați pot fi incluși într-un singur raport.
              </p>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              5000
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-700">
                Font utilizat
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Helvetica (regular + bold) — font standard PDF, fără necesitate de embedding.
              </p>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Helvetica
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-700">
                Culori design
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Header slate-800, accent blue-500, text slate-900.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1e293b]" title="slate-800" />
              <span className="w-5 h-5 rounded-full bg-[#3b82f6]" title="blue-500" />
              <span className="w-5 h-5 rounded-full bg-[#0f172a]" title="slate-900" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
