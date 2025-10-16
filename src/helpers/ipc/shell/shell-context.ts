import { SHELL_OPEN_EXTERNAL_CHANNEL } from "./shell-channels";

export function exposeShellContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");

  contextBridge.exposeInMainWorld("electronShell", {
    openExternal: (url: string) => ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url),
  });
}
