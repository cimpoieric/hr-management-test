"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, Loader2, type LucideIcon } from "lucide-react";

export function DataLoadingSpinner({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function DataErrorState({
  message,
  retryLabel,
  onRetry,
  className,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-14 px-4 text-center",
        className,
      )}
      role="alert"
    >
      <AlertCircle
        className="h-10 w-10 text-destructive shrink-0"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function DataEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      <Icon className="h-12 w-12 text-gray-300" aria-hidden />
      <p className="mt-4 text-base font-medium text-gray-800">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

/** Skeleton rows matching the employee table column layout. */
export function EmployeeTableSkeletonBody({
  showBulkActions,
  rows = 8,
}: {
  showBulkActions: boolean;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr
          key={rowIdx}
          className="border-b border-gray-100 last:border-b-0 bg-white"
        >
          {showBulkActions && (
            <td className="sticky left-0 z-20 w-10 px-2 py-3 bg-white border-r border-gray-100">
              <Skeleton className="h-4 w-4 rounded" />
            </td>
          )}
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="mt-2 h-3 w-[60%]" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-[75%]" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-[70%]" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-14" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-8" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-16 rounded-full" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-10" />
          </td>
          <td className="min-w-0 px-2 py-3 max-2xl:px-1.5">
            <Skeleton className="h-4 w-10" />
          </td>
          <td className="sticky right-0 z-10 w-[118px] max-2xl:w-[108px] px-1 py-3 bg-white border-l border-gray-100">
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
