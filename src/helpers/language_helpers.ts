import type { i18n } from "i18next";

const languageLocalStorageKey = "lang";

export async function setAppLanguage(lang: string, i18n: i18n) {
  localStorage.setItem(languageLocalStorageKey, lang);
  try {
    await window.rushLanguage?.set(lang);
  } catch (error) {
    console.warn("[rushmeme] failed to persist language preference", error);
  }
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export async function updateAppLanguage(i18n: i18n) {
  let resolvedLang =
    localStorage.getItem(languageLocalStorageKey) ?? i18n.language;

  try {
    const storedLang = await window.rushLanguage?.get();
    if (storedLang) {
      resolvedLang = storedLang;
      localStorage.setItem(languageLocalStorageKey, storedLang);
    }
  } catch (error) {
    console.warn("[rushmeme] failed to load persisted language", error);
  }

  if (!resolvedLang) {
    return;
  }

  if (i18n.language !== resolvedLang) {
    await i18n.changeLanguage(resolvedLang);
  }
  document.documentElement.lang = resolvedLang;
}
