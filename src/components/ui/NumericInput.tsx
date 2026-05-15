"use client";

import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { cn } from "@/lib/utils";
import type * as React from "react";

export type NumericInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string | number;
  onValueChange: (value: string) => void;
  /** Allow decimal separator (comma/dot). Default true. */
  decimal?: boolean;
};

/**
 * Controlled numeric text field — avoids native number spinners and wheel drift.
 */
export function NumericInput({
  value,
  onValueChange,
  decimal = true,
  className,
  onWheel,
  ...props
}: NumericInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onWheel={(e) => {
        preventWheelOnFocusedNumberInput(e);
        onWheel?.(e);
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 tabular-nums",
        className,
      )}
    />
  );
}
