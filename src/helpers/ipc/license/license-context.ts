import { contextBridge, ipcRenderer } from "electron";
import type { LicenseSnapshot } from "@/types/config";
import type {
  LicenseActivationSummary,
  LicenseOperationResult,
} from "./license-service";
import {
  LICENSE_ACTIVATE_CHANNEL,
  LICENSE_DEACTIVATE_CHANNEL,
  LICENSE_FETCH_ACTIVATIONS_CHANNEL,
  LICENSE_GET_STATUS_CHANNEL,
  LICENSE_UPDATED_EVENT_CHANNEL,
  LICENSE_VALIDATE_CHANNEL,
  LICENSE_WATCH_CHANNEL,
  LICENSE_HEARTBEAT_ERROR_EVENT_CHANNEL,
  LICENSE_GET_CACHED_STATUS_CHANNEL,
} from "./license-channels";

export function exposeLicenseContext() {
  let cachedSnapshot = ipcRenderer.sendSync(
    LICENSE_GET_CACHED_STATUS_CHANNEL,
  ) as LicenseSnapshot;
  let rendererProFlag = cachedSnapshot?.status === "active";

  const updateRendererProFlag = (snapshot: LicenseSnapshot | null) => {
    const proActive = snapshot?.status === "active";
    rendererProFlag = proActive;
  };

  updateRendererProFlag(cachedSnapshot);

  contextBridge.exposeInMainWorld("rushLicenseInitialState", {
    getSnapshot: () => cachedSnapshot,
    isPro: () => cachedSnapshot?.status === "active",
  });

  contextBridge.exposeInMainWorld("rushProRuntime", {
    getFlag: () => rendererProFlag,
  });

  contextBridge.exposeInMainWorld("rushLicense", {
    getStatus: () =>
      ipcRenderer.invoke(
        LICENSE_GET_STATUS_CHANNEL,
      ) as Promise<LicenseSnapshot>,
    activate: (key: string) =>
      ipcRenderer.invoke(
        LICENSE_ACTIVATE_CHANNEL,
        key,
      ) as Promise<LicenseOperationResult>,
    validate: () =>
      ipcRenderer.invoke(
        LICENSE_VALIDATE_CHANNEL,
      ) as Promise<LicenseOperationResult>,
    deactivate: () =>
      ipcRenderer.invoke(
        LICENSE_DEACTIVATE_CHANNEL,
      ) as Promise<LicenseOperationResult>,
    fetchActivationSummary: () =>
      ipcRenderer.invoke(
        LICENSE_FETCH_ACTIVATIONS_CHANNEL,
      ) as Promise<{
        success: boolean;
        snapshot: LicenseSnapshot;
        summary: LicenseActivationSummary | null;
        code?: string;
        message?: string;
      }>,
    watch: async (
      listener: (snapshot: LicenseSnapshot) => void,
    ): Promise<() => void> => {
      const handler = (_event: unknown, snapshot: LicenseSnapshot) => {
        cachedSnapshot = snapshot;
        updateRendererProFlag(cachedSnapshot);
        listener(snapshot);
      };
      ipcRenderer.on(LICENSE_UPDATED_EVENT_CHANNEL, handler);
      const initialSnapshot = (await ipcRenderer.invoke(
        LICENSE_WATCH_CHANNEL,
      )) as LicenseSnapshot;
      cachedSnapshot = initialSnapshot;
      updateRendererProFlag(cachedSnapshot);
      listener(initialSnapshot);
      return () => {
        ipcRenderer.removeListener(LICENSE_UPDATED_EVENT_CHANNEL, handler);
      };
    },
    onHeartbeatError: (
      listener: (details: { code: string; message: string }) => void,
    ) => {
      const handler = (
        _event: unknown,
        details: { code: string; message: string },
      ) => {
        listener(details);
      };
      ipcRenderer.on(LICENSE_HEARTBEAT_ERROR_EVENT_CHANNEL, handler);
      return () => {
        ipcRenderer.removeListener(LICENSE_HEARTBEAT_ERROR_EVENT_CHANNEL, handler);
      };
    },
  });
}
