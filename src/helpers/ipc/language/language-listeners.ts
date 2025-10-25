import { ipcMain } from "electron";
import {
  LANGUAGE_GET_CHANNEL,
  LANGUAGE_SET_CHANNEL,
} from "./language-channels";
import type { SupportedLocale } from "./language-store";
import { getStoredLanguage, setStoredLanguage } from "./language-store";

type LanguageListenerOptions = {
  onLanguageChanged?: (locale: SupportedLocale) => void;
};

export function addLanguageEventListeners(options?: LanguageListenerOptions) {
  ipcMain.handle(LANGUAGE_GET_CHANNEL, () => getStoredLanguage());
  ipcMain.handle(
    LANGUAGE_SET_CHANNEL,
    (_event, locale: string) => {
      const normalized = setStoredLanguage(locale);
      options?.onLanguageChanged?.(normalized);
      return normalized;
    },
  );
}
