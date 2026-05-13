"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/useTranslation";
import { defaultLng, supportedLngs, type SupportedLng } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useMemo } from "react";

/** GB flag + RO flag (Unicode regional indicators). */
const FLAG: Record<SupportedLng, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  ro: "\u{1F1F7}\u{1F1F4}",
};

const CODE: Record<SupportedLng, string> = {
  en: "EN",
  ro: "RO",
};

function normalizeLanguage(lang: string | undefined): SupportedLng {
  if (lang && (supportedLngs as readonly string[]).includes(lang)) {
    return lang as SupportedLng;
  }
  return defaultLng;
}

export function LanguageSelector() {
  const { changeLanguage, currentLanguage } = useTranslation();
  const active = useMemo(
    () => normalizeLanguage(currentLanguage),
    [currentLanguage],
  );

  const handleChange = (newLang: SupportedLng) => {
    changeLanguage(newLang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-slate-200 bg-white px-2 font-normal text-slate-700 shadow-none hover:bg-slate-50"
          aria-label="Select language"
        >
          <span className="text-base leading-none" aria-hidden>
            {FLAG[active]}
          </span>
          <span className="text-xs font-medium tabular-nums tracking-tight">
            {CODE[active]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {supportedLngs.map((lang) => (
          <DropdownMenuItem
            key={lang}
            className={cn(
              "flex cursor-pointer items-center gap-2",
              active === lang && "bg-slate-50",
            )}
            onSelect={() => {
              handleChange(lang);
            }}
          >
            <span className="text-base leading-none" aria-hidden>
              {FLAG[lang]}
            </span>
            <span className="flex-1 text-sm font-medium">{CODE[lang]}</span>
            {active === lang ? (
              <Check className="h-4 w-4 text-slate-700" aria-hidden />
            ) : (
              <span className="inline-block w-4" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
