import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { cn } from "@/lib/utils";
import type * as React from "react";

export function Input({
  className,
  type = "text",
  onWheel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        type === "number" && "tabular-nums",
        className,
      )}
      onWheel={(e) => {
        if (type === "number") {
          preventWheelOnFocusedNumberInput(e);
        }
        onWheel?.(e);
      }}
      {...props}
    />
  );
}
