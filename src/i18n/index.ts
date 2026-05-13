import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLng, supportedLngs } from "./constants";
import enTranslation from "./locales/en";
import roTranslation from "./locales/ro";

/** i18next starts with `defaultLng`; `I18nProvider` owns runtime language state. */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: defaultLng,
    fallbackLng: defaultLng,
    supportedLngs: [...supportedLngs],
    defaultNS: "translation",
    ns: ["translation"],
    resources: {
      en: { translation: enTranslation },
      ro: { translation: roTranslation },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
