import { contextBridge, ipcRenderer } from "electron";
import {
  CONFIG_GET_CHANNEL,
  CONFIG_SAVE_CHANNEL,
  CONFIG_TEST_ALCHEMY_KEY_CHANNEL,
  PLATFORM_EXECUTE_CHANNEL,
  CONFIG_SHORTCUTS_DISABLE_CHANNEL,
  CONFIG_SHORTCUTS_ENABLE_CHANNEL,
} from "./config-channels";
import type {
  AppConfigSavePayload,
  ExecutePlatformsRequest,
  ExecutePlatformsResponse,
  RuntimeConfig,
  AlchemyApiKeyTestResult,
} from "@/types/config";

export function exposeConfigContext() {
  contextBridge.exposeInMainWorld("rushConfig", {
    getConfig: () =>
      ipcRenderer.invoke(CONFIG_GET_CHANNEL) as Promise<RuntimeConfig>,
    saveConfig: (config: AppConfigSavePayload) =>
      ipcRenderer.invoke(CONFIG_SAVE_CHANNEL, config) as Promise<void>,
    testAlchemyApiKey: (apiKey: string) =>
      ipcRenderer.invoke(
        CONFIG_TEST_ALCHEMY_KEY_CHANNEL,
        apiKey,
      ) as Promise<AlchemyApiKeyTestResult>,
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
