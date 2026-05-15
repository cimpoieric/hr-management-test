"use client";

import { useIsClient } from "@/hooks/useIsClient";
import { Toaster, type ToasterProps } from "sonner";

export function ClientToaster(props: ToasterProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return <Toaster {...props} />;
}
