import {
  CONFIG_GET_CHANNEL,
  CONFIG_SAVE_CHANNEL,
  PLATFORM_EXECUTE_CHANNEL,
  CONFIG_SHORTCUTS_DISABLE_CHANNEL,
  CONFIG_SHORTCUTS_ENABLE_CHANNEL,
} from "./config-channels";
import type {
  AppConfig,
  ExecutePlatformsRequest,
  ExecutePlatformsResponse,
  RuntimeConfig,
} from "@/types/config";

export function exposeConfigContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");

  contextBridge.exposeInMainWorld("rushConfig", {
    getConfig: () =>
      ipcRenderer.invoke(CONFIG_GET_CHANNEL) as Promise<RuntimeConfig>,
    saveConfig: (config: AppConfig) =>
      ipcRenderer.invoke(CONFIG_SAVE_CHANNEL, config) as Promise<void>,
    executePlatforms: (payload?: ExecutePlatformsRequest) =>
      ipcRenderer.invoke(
        PLATFORM_EXECUTE_CHANNEL,
        payload,
      ) as Promise<ExecutePlatformsResponse>,
    suspendShortcuts: () => {
      ipcRenderer.sendSync(CONFIG_SHORTCUTS_DISABLE_CHANNEL);
    },
    resumeShortcuts: () => {
      ipcRenderer.sendSync(CONFIG_SHORTCUTS_ENABLE_CHANNEL);
    },
  });
}
