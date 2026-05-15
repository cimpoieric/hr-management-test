"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

interface BulkSelectionProps {
  selectedIds: number[];
  totalResults: number;
  onClear: () => void;
  onSelectAllResults: () => void;
}

export function BulkSelectionBar({
  selectedIds,
  totalResults,
  onClear,
  onSelectAllResults,
}: BulkSelectionProps) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  if (selectedIds.length === 0) return null;

  async function handleExport(type: "excel" | "pdf") {
    setExporting(type);
    try {
      const endpoint =
        type === "excel" ? "/api/export/excel" : "/api/export/pdf";
      const body = {
        employeeIds: selectedIds,
        columns: [
          "id",
          "firstName",
          "lastName",
          "cnp",
          "email",
          "phone",
          "status",
          "position",
          "company",
        ],
        format: type,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        alert((d.error as string) ?? t("components.bulkSelection.exportError"));
        setExporting(null);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees-export-${type === "excel" ? "xlsx" : "pdf"}.${type === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(t("components.bulkSelection.exportError"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="sticky top-0 z-30 bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {t("components.bulkSelection.selectedCount", {
            count: selectedIds.length,
          })}
        </span>
        {selectedIds.length < totalResults && (
          <button
            onClick={onSelectAllResults}
            className="text-xs text-slate-300 hover:text-white underline"
          >
            {t("components.bulkSelection.selectAllResults", {
              count: totalResults,
            })}
          </button>
        )}
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-white"
        >
          {t("components.bulkSelection.clearSelection")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("excel")}
          disabled={exporting !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {exporting === "excel" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={14} />
          )}
          {t("components.bulkSelection.excel")}
        </button>
        <button
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {exporting === "pdf" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          {t("components.bulkSelection.pdf")}
        </button>
      </div>
    </div>
  );
}
