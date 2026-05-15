import { cn } from "@/lib/utils";
import type * as React from "react";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-sm font-medium leading-none text-gray-700",
        className,
      )}
      {...props}
    />
  );
}
