"use client";

import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { cn } from "@/lib/utils";
import type * as React from "react";

type ReadOnlyFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** When true, forces readOnly styling + tooltip */
  readOnly?: boolean;
  /** Tooltip text for readOnly state */
  readOnlyTooltip?: string;
};

export function ReadOnlyField({
  readOnly,
  readOnlyTooltip = "Nu aveti permisiune de editare",
  className,
  title,
  ...props
}: ReadOnlyFieldProps) {
  const ro = Boolean(readOnly);

  return (
    <input
      {...props}
      readOnly={ro}
      aria-readonly={ro || undefined}
      title={ro ? readOnlyTooltip : title}
      className={cn(
        "w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900",
        ro &&
          "bg-gray-100 cursor-not-allowed border-gray-300 focus:ring-0 focus:outline-none focus:border-gray-300",
        className,
      )}
      onWheel={(e) => {
        if (props.type === "number") {
          preventWheelOnFocusedNumberInput(e);
        }
        props.onWheel?.(e);
      }}
      onFocus={(e) => {
        if (ro) e.currentTarget.blur();
        props.onFocus?.(e);
      }}
    />
  );
}
