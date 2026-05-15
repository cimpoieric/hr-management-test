"use client";

import {
  type DocumentExpiryBucket,
  getDocumentExpiryBucket,
} from "@/lib/documentExpiryUi";
import type { DocumentStatus } from "@/lib/documentStatus";
import { tDocumentStatus } from "@/messages";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

interface DocumentStatusBadgeProps {
  status: DocumentStatus | string;
  size?: "sm" | "md";
  expiryDate?: string | null;
  /** Implicit 30 — aliniat la setări / listă documente. */
  expiringSoonDays?: number;
}

const styleByBucket: Record<
  DocumentExpiryBucket,
  { icon: React.ElementType; bg: string; text: string; label: string }
> = {
  valid: {
    icon: CheckCircle2,
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Valabil",
  },
  expiring_soon: {
    icon: AlertTriangle,
    bg: "bg-amber-100",
    text: "text-amber-800",
    label: "Expiră curând",
  },
  expired: {
    icon: XCircle,
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Expirat",
  },
  pending: {
    icon: Clock,
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: tDocumentStatus("PENDING"),
  },
};

export function DocumentStatusBadge({
  status,
  size = "sm",
  expiryDate,
  expiringSoonDays = 30,
}: DocumentStatusBadgeProps) {
  const bucket = getDocumentExpiryBucket(
    String(status),
    expiryDate ?? null,
    expiringSoonDays,
  );
  const c = styleByBucket[bucket];
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${c.bg} ${c.text} ${
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
      }`}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {c.label}
    </span>
  );
}

const styleByStatus: Record<string, { icon: React.ElementType; text: string }> =
  {
    VALID: { icon: CheckCircle2, text: "text-green-700" },
    EXPIRING_SOON: { icon: AlertTriangle, text: "text-amber-700" },
    EXPIRED: { icon: XCircle, text: "text-red-700" },
    PENDING: { icon: Clock, text: "text-gray-600" },
  };

/** Icon-only variant pentru tabele compacte */
export function DocumentStatusIcon({
  status,
}: {
  status: DocumentStatus | string;
}) {
  const c = styleByStatus[status] ?? styleByStatus["PENDING"]!;
  const Icon = c.icon;
  const label = tDocumentStatus(String(status));
  return (
    <span title={label}>
      <Icon size={16} className={c.text} />
    </span>
  );
}
