import { contextBridge, ipcRenderer } from "electron";
import {
  LANGUAGE_GET_CHANNEL,
  LANGUAGE_SET_CHANNEL,
} from "./language-channels";

export function exposeLanguageContext() {
  contextBridge.exposeInMainWorld("rushLanguage", {
    get: () => ipcRenderer.invoke(LANGUAGE_GET_CHANNEL) as Promise<string>,
    set: (locale: string) =>
      ipcRenderer.invoke(LANGUAGE_SET_CHANNEL, locale) as Promise<string>,
  });
}
