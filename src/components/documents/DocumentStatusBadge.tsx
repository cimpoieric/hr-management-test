"use client";

import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { DocumentStatus } from "@/lib/documentStatus";
import { tDocumentStatus } from "@/messages";

interface DocumentStatusBadgeProps {
  status: DocumentStatus | string;
  size?: "sm" | "md";
}

const styleByStatus: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  VALID: {
    icon: CheckCircle2,
    bg: "bg-green-100",
    text: "text-green-700",
  },
  EXPIRING_SOON: {
    icon: AlertTriangle,
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  EXPIRED: {
    icon: XCircle,
    bg: "bg-red-100",
    text: "text-red-700",
  },
  PENDING: {
    icon: Clock,
    bg: "bg-gray-100",
    text: "text-gray-600",
  },
};

export function DocumentStatusBadge({ status, size = "sm" }: DocumentStatusBadgeProps) {
  const c = styleByStatus[status] ?? styleByStatus["PENDING"]!;
  const Icon = c.icon;
  const label = tDocumentStatus(String(status));

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${c.bg} ${c.text} ${
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
      }`}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {label}
    </span>
  );
}

/** Icon-only variant pentru tabele compacte */
export function DocumentStatusIcon({ status }: { status: DocumentStatus | string }) {
  const c = styleByStatus[status] ?? styleByStatus["PENDING"]!;
  const Icon = c.icon;
  const label = tDocumentStatus(String(status));
  return (
    <span title={label}>
      <Icon size={16} className={c.text.replace("text-", "text-")} />
    </span>
  );
}
