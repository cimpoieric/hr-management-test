"use client";

import {
  useAppLanguage,
  useChangeAppLanguage,
} from "@/components/I18nProvider";
import { useTranslation as useI18nTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import type { SupportedLng } from "@/i18n/config";

const defaultNS = "translation" as const;

export type { SupportedLng };

/**
 * Thin wrapper around react-i18next with app `changeLanguage` and `currentLanguage`.
 */
export function useTranslation() {
  const activeLang = useAppLanguage();
  const changeAppLanguage = useChangeAppLanguage();
  const { t: i18nT, i18n } = useI18nTranslation(defaultNS);

  const t = useCallback(
    (key: string, options?: Record<string, unknown> | string) => {
      if (typeof options === "string") {
        return i18nT(key, options, { lng: activeLang });
      }
      return i18nT(key, { ...options, lng: activeLang });
    },
    [activeLang, i18nT],
  ) as TFunction<"translation">;

  const changeLanguage = useCallback(
    (lang: SupportedLng) => {
      changeAppLanguage(lang);
    },
    [changeAppLanguage],
  );

  const currentLanguage = activeLang;

  return useMemo(
    () => ({ t, i18n, changeLanguage, currentLanguage }),
    [t, i18n, changeLanguage, currentLanguage],
  );
}
