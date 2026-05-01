"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";

export default function DocumentePage() {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documente</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionare documente — upload, monitorizare, expirare
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Upload size={16} />
          {showUpload ? "Închide upload" : "Upload document"}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Upload document nou</h2>
          <DocumentUpload
            employeeId={0}
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setShowUpload(false);
            }}
          />
          <p className="text-xs text-gray-400 mt-3">
            Selectează angajatul din lista de mai jos sau alege un angajat specific.
          </p>
        </div>
      )}

      {/* Global document list */}
      <DocumentList key={refreshKey} showEmployee />
    </div>
  );
}
