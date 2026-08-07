import Store from "electron-store";

export type SupportedLocale = "en" | "zh-CN";

const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "zh-CN"];

const languageStore = new Store<{ locale: string }>({
  name: "rushmeme-language",
  defaults: {
    locale: "en",
  },
});

function normalizeLocale(locale: unknown): SupportedLocale | null {
  if (typeof locale !== "string") {
    return null;
  }

  const candidate = locale.trim();
  if (!candidate) {
    return null;
  }

  const exactMatch = SUPPORTED_LOCALES.find(
    (supported) => supported.toLowerCase() === candidate.toLowerCase(),
  );
  if (exactMatch) {
    return exactMatch;
  }

  const lowered = candidate.toLowerCase();
  if (lowered.startsWith("zh")) {
    return "zh-CN";
  }
  if (lowered.startsWith("en")) {
    return "en";
  }

  return null;
}

export function getStoredLanguage(): SupportedLocale {
  const stored = languageStore.get("locale");
  return normalizeLocale(stored) ?? "en";
}

export function setStoredLanguage(locale: string): SupportedLocale {
  const normalized = normalizeLocale(locale) ?? "en";
  languageStore.set("locale", normalized);
  return normalized;
}

export function getPreferredLanguage(fallbackLocale?: string): SupportedLocale {
  const stored = normalizeLocale(languageStore.get("locale"));
  if (stored) {
    return stored;
  }

  const fallback = normalizeLocale(fallbackLocale);
  if (fallback) {
    languageStore.set("locale", fallback);
    return fallback;
  }

  return "en";
}
