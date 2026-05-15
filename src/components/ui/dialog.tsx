"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") onOpenChange(false);
      }}
    >
      <DialogBackdrop onClose={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
        <div
          className={cn(
            "relative z-[51] w-full max-w-lg rounded-xl border bg-white shadow-lg",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <DialogTitleBlock title={title} description={description} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-6">{children}</div>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </div>
      </div>
    </div>
  );
}

function DialogBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close dialog"
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    />
  );
}

function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  );
}

function DialogTitleBlock({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
