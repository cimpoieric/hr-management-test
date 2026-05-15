"use client";

import { COMPANY_LOGO_CHANGED_EVENT } from "@/lib/companyLogoEvents";
import { useCallback, useEffect, useState } from "react";

/** Company logo from GET /api/settings/logo (R2 HTTPS or data URL). undefined = loading; null = none. */
export function useCompanyLogo() {
  const [companyLogoUrl, setCompanyLogoUrl] = useState<
    string | null | undefined
  >(undefined);

  const loadCompanyLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setCompanyLogoUrl(null);
        return;
      }
      const data = (await res.json()) as { exists?: boolean; url?: string };
      setCompanyLogoUrl(data.exists && data.url ? String(data.url) : null);
    } catch {
      setCompanyLogoUrl(null);
    }
  }, []);

  useEffect(() => {
    void loadCompanyLogo();
    const onLogoChanged = () => {
      void loadCompanyLogo();
    };
    window.addEventListener(COMPANY_LOGO_CHANGED_EVENT, onLogoChanged);
    return () =>
      window.removeEventListener(COMPANY_LOGO_CHANGED_EVENT, onLogoChanged);
  }, [loadCompanyLogo]);

  return { companyLogoUrl, refetchCompanyLogo: loadCompanyLogo };
}
