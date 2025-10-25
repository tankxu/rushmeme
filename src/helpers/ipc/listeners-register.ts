import { BrowserWindow } from "electron";
import type { AppConfig } from "@/types/config";
import type { SupportedLocale } from "./language/language-store";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addConfigEventListeners } from "./config/config-listeners";
import { addShellEventListeners } from "./shell/shell-listeners";
import { addLanguageEventListeners } from "./language/language-listeners";

type ListenerOptions = {
  onConfigUpdated?: (config: AppConfig) => void;
  onLanguageChanged?: (locale: SupportedLocale) => void;
};

export default function registerListeners(
  mainWindow: BrowserWindow,
  options?: ListenerOptions,
) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addConfigEventListeners(mainWindow, {
    onConfigUpdated: options?.onConfigUpdated,
  });
  addShellEventListeners();
  addLanguageEventListeners({
    onLanguageChanged: options?.onLanguageChanged,
  });
}
