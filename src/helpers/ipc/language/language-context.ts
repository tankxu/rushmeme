import {
  LANGUAGE_GET_CHANNEL,
  LANGUAGE_SET_CHANNEL,
} from "./language-channels";

export function exposeLanguageContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("rushLanguage", {
    get: () => ipcRenderer.invoke(LANGUAGE_GET_CHANNEL) as Promise<string>,
    set: (locale: string) =>
      ipcRenderer.invoke(LANGUAGE_SET_CHANNEL, locale) as Promise<string>,
  });
}
