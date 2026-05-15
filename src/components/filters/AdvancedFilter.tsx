"use client";

import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Globe,
  MapPin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface FilterState {
  search: string;
  status: string[];
  company: string[];
  /** Deployment: country codes (e.g. NL, DE) */
  country: string[];
  /** Residence: Country table ids */
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const statusOptions = useMemo(
    () => [
      {
        value: "ACTIVE",
        label: t("components.advancedFilter.statusActive"),
        color: "bg-green-500",
      },
      {
        value: "TERMINATED",
        label: t("components.advancedFilter.statusTerminated"),
        color: "bg-red-500",
      },
    ],
    [t],
  );

  const docTypeOptions = useMemo(
    () => [
      { value: "", label: t("components.advancedFilter.docAll") },
      {
        value: "CONTRACT",
        label: t("components.advancedFilter.docContractExpired"),
      },
      { value: "A1", label: t("components.advancedFilter.docA1Expired") },
      {
        value: "MEDICAL",
        label: t("components.advancedFilter.docMedicalExpired"),
      },
      { value: "ANY", label: t("components.advancedFilter.docAnyExpired") },
    ],
    [t],
  );

  const update = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange],
  );

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

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
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {t("components.advancedFilter.title")}
          </span>
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
              {t("common.reset")}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              <Search size={12} className="inline mr-1" />
              {t("components.advancedFilter.search")}
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
                placeholder={t("components.advancedFilter.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                {t("components.advancedFilter.status")}
              </label>
              <div className="space-y-1.5">
                {statusOptions.map((s) => (
                  <label
                    key={s.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.status.includes(s.value)}
                      onChange={() =>
                        update(
                          "status",
                          toggleArrayItem(filters.status, s.value),
                        )
                      }
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

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Building2 size={12} className="inline mr-1" />
                {t("components.advancedFilter.employerCompany")}
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.company.includes(String(c.id))}
                      onChange={() =>
                        update(
                          "company",
                          toggleArrayItem(filters.company, String(c.id)),
                        )
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 truncate">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Globe size={12} className="inline mr-1" />
                {t("components.advancedFilter.countryResidence")}
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {countries.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.employeeCountry.includes(String(c.id))}
                      onChange={() =>
                        update(
                          "employeeCountry",
                          toggleArrayItem(
                            filters.employeeCountry,
                            String(c.id),
                          ),
                        )
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

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <MapPin size={12} className="inline mr-1" />
                {t("components.advancedFilter.countryDeployment")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DEPLOYMENT_COUNTRIES.slice(0, 6).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() =>
                      update(
                        "country",
                        toggleArrayItem(filters.country, c.code),
                      )
                    }
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

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <FileText size={12} className="inline mr-1" />
                {t("components.advancedFilter.documents")}
              </label>
              <select
                value={filters.expiredDocumentType}
                onChange={(e) => update("expiredDocumentType", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              >
                {docTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.expiringSoon}
                  onChange={(e) => update("expiringSoon", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  {t("components.advancedFilter.expiringSoonOnly")}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                <Calendar size={12} className="inline mr-1" />
                {t("components.advancedFilter.hirePeriod")}
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.hireDateFrom}
                  onChange={(e) => update("hireDateFrom", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                  title={t("components.advancedFilter.hireFromPlaceholder")}
                />
                <input
                  type="date"
                  value={filters.hireDateTo}
                  onChange={(e) => update("hireDateTo", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                  title={t("components.advancedFilter.hireToPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                {t("components.advancedFilter.other")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasAssignment}
                  onChange={(e) => update("hasAssignment", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  {t("components.advancedFilter.activeDeploymentOnly")}
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-end gap-2">
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t("components.advancedFilter.resetFilters")}
            </button>
            <button
              onClick={() => {
                onApply();
                setExpanded(false);
              }}
              className="px-6 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              {t("components.advancedFilter.applyFilters")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
