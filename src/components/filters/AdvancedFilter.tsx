"use client";

import { useState, useCallback } from "react";
import {
  Filter,
  X,
  Search,
  Calendar,
  FileText,
  Globe,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";

export interface FilterState {
  search: string;
  status: string[];
  company: string[];
  /** Detașare: coduri țară (ex. NL, DE) */
  country: string[];
  /** Domiciliu: id-uri din tabelul Country */
  employeeCountry: string[];
  expiredDocumentType: string;
  expiringSoon: boolean;
  hireDateFrom: string;
  hireDateTo: string;
  hasAssignment: boolean;
}

interface AdvancedFilterProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  companies: { id: number; name: string }[];
  countries: { id: number; name: string; code: string }[];
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activ", color: "bg-green-500" },
  { value: "TERMINATED", label: "Terminat", color: "bg-red-500" },
];

const DOC_TYPE_OPTIONS = [
  { value: "", label: "— Toate documentele —" },
  { value: "CONTRACT", label: "Contract expirat" },
  { value: "A1", label: "A1 expirat" },
  { value: "MEDICAL", label: "Medical expirat" },
  { value: "ANY", label: "Orice document expirat" },
];

export const defaultFilters: FilterState = {
  search: "",
  status: [],
  company: [],
  country: [],
  employeeCountry: [],
  expiredDocumentType: "",
  expiringSoon: false,
  hireDateFrom: "",
  hireDateTo: "",
  hasAssignment: false,
};

export function AdvancedFilter({
  filters,
  onChange,
  onApply,
  onReset,
  companies,
  countries,
}: AdvancedFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const update = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

  // Număr filtre active
  const activeCount = [
    filters.search,
    filters.status.length > 0,
    filters.company.length > 0,
    filters.country.length > 0,
    filters.employeeCountry.length > 0,
    filters.expiredDocumentType,
    filters.expiringSoon,
    filters.hireDateFrom,
    filters.hireDateTo,
    filters.hasAssignment,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      {/* Header — compact */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtre avansate</span>
          {activeCount > 0 && (
            <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full font-medium">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onReset();
                }
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors cursor-pointer select-none"
            >
              <RotateCcw size={12} />
              Reset
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 border-t">
          {/* Search */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              <Search size={12} className="inline mr-1" />
              Căutare
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
                placeholder="Nume, CNP, email, telefon..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              {filters.search && (
                <button
                  onClick={() => update("search", "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Grid 3 coloane */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <div className="space-y-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(s.value)}
                      onChange={() => update("status", toggleArrayItem(filters.status, s.value))}
                      className="rounded"
                    />
                    <span className="flex items-center gap-1.5 text-sm text-gray-700">
                      <span className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Firmă */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Building2 size={12} className="inline mr-1" />
                Firmă angajatoare
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {companies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.company.includes(String(c.id))}
                      onChange={() => update("company", toggleArrayItem(filters.company, String(c.id)))}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Țară domiciliu (angajat) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Globe size={12} className="inline mr-1" />
                Țară (domiciliu)
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {countries.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.employeeCountry.includes(String(c.id))}
                      onChange={() =>
                        update("employeeCountry", toggleArrayItem(filters.employeeCountry, String(c.id)))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 truncate">
                      {c.name} ({c.code})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Țară detașare */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <MapPin size={12} className="inline mr-1" />
                Țară detașare
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DEPLOYMENT_COUNTRIES.slice(0, 6).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => update("country", toggleArrayItem(filters.country, c.code))}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filters.country.includes(c.code)
                        ? "bg-slate-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {c.flag} {c.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Documente expirate */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <FileText size={12} className="inline mr-1" />
                Documente
              </label>
              <select
                value={filters.expiredDocumentType}
                onChange={(e) => update("expiredDocumentType", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              >
                {DOC_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.expiringSoon}
                  onChange={(e) => update("expiringSoon", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Doar ce expiră curând</span>
              </label>
            </div>

            {/* Perioadă angajare */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Calendar size={12} className="inline mr-1" />
                Perioadă angajare
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.hireDateFrom}
                  onChange={(e) => update("hireDateFrom", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                  placeholder="De la"
                />
                <input
                  type="date"
                  value={filters.hireDateTo}
                  onChange={(e) => update("hireDateTo", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                  placeholder="Până la"
                />
              </div>
            </div>

            {/* Altele */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Altele
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasAssignment}
                  onChange={(e) => update("hasAssignment", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Doar cu detașare activă
                </span>
              </label>
            </div>
          </div>

          {/* Aplică */}
          <div className="mt-4 pt-3 border-t flex items-center justify-end gap-2">
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Resetează
            </button>
            <button
              onClick={() => { onApply(); setExpanded(false); }}
              className="px-6 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Aplică filtre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
