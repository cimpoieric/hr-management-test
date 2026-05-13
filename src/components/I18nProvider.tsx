"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { I18nextProvider } from "react-i18next";
import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { defaultLng, type SupportedLng } from "@/i18n/constants";

type I18nContextValue = {
  lang: SupportedLng;
  changeLanguage: (lang: SupportedLng) => void;
};

const I18nContext = createContext<I18nContextValue>({
  lang: defaultLng,
  changeLanguage: () => undefined,
});

export function useAppLanguage(): SupportedLng {
  return useContext(I18nContext).lang;
}

export function useChangeAppLanguage(): (lang: SupportedLng) => void {
  return useContext(I18nContext).changeLanguage;
}

/** First render is always English; language changes only via LanguageSelector. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<SupportedLng>(defaultLng);

  const changeLanguage = useCallback((newLang: SupportedLng) => {
    setLang(newLang);
    void i18n.changeLanguage(newLang);
  }, []);

  const value = useMemo(
    () => ({ lang, changeLanguage }),
    [changeLanguage, lang],
  );

  return (
    <I18nContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </I18nContext.Provider>
  );
}

export type { TFunction };
