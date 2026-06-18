"use client";

import * as React from "react";
import { dictionaries, type Dictionary } from "./dictionaries";

export type Locale = "en" | "ar";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  setLocale: (l: Locale) => void;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }, []);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: dictionaries[locale],
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
