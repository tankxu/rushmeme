import { contextBridge, ipcRenderer } from "electron";
import type { AppLatestRelease, AppRuntimeInfo } from "@/types/app";
import {
  APP_FETCH_LATEST_CHANNEL,
  APP_GET_RUNTIME_INFO_CHANNEL,
  APP_GET_VERSION_CHANNEL,
} from "./app-channels";

type FetchLatestResponse =
  | {
      ok: true;
      data: AppLatestRelease;
    }
  | {
      ok: false;
      status?: number;
      message: string;
    };

type FetchLatestOptions = {
  channel?: string;
};

export function exposeAppContext() {
  contextBridge.exposeInMainWorld("rushApp", {
    getVersion: () =>
      ipcRenderer.invoke(APP_GET_VERSION_CHANNEL) as Promise<string>,
    fetchLatestRelease: (options?: FetchLatestOptions) =>
      ipcRenderer.invoke(
        APP_FETCH_LATEST_CHANNEL,
        options,
      ) as Promise<FetchLatestResponse>,
    getRuntimeInfo: () =>
      ipcRenderer.invoke(
        APP_GET_RUNTIME_INFO_CHANNEL,
      ) as Promise<AppRuntimeInfo>,
  });
}
