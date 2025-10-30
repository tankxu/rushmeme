import { contextBridge, ipcRenderer } from "electron";
import { SHELL_OPEN_EXTERNAL_CHANNEL } from "./shell-channels";

export function exposeShellContext() {
  contextBridge.exposeInMainWorld("electronShell", {
    openExternal: (url: string) => ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url),
  });
}
