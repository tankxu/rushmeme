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
} from "./license-channels";

export function exposeLicenseContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");

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
        listener(snapshot);
      };
      ipcRenderer.on(LICENSE_UPDATED_EVENT_CHANNEL, handler);
      const initialSnapshot = (await ipcRenderer.invoke(
        LICENSE_WATCH_CHANNEL,
      )) as LicenseSnapshot;
      listener(initialSnapshot);
      return () => {
        ipcRenderer.removeListener(LICENSE_UPDATED_EVENT_CHANNEL, handler);
      };
    },
  });
}
