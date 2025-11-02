import { app, ipcMain } from "electron";
import {
  APP_FETCH_LATEST_CHANNEL,
  APP_GET_RUNTIME_INFO_CHANNEL,
  APP_GET_VERSION_CHANNEL,
} from "./app-channels";
import type { AppLatestRelease, AppRuntimeInfo } from "@/types/app";

type FetchLatestOptions = {
  channel?: string | null;
};

type FetchLatestResult =
  | {
      ok: true;
      data: AppLatestRelease;
    }
  | {
      ok: false;
      status?: number;
      message: string;
    };

function normalizeChannel(options?: FetchLatestOptions): string | undefined {
  const channel = options?.channel;
  if (typeof channel !== "string") {
    return undefined;
  }
  const trimmed = channel.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

export function addAppEventListeners() {
  ipcMain.handle(APP_GET_VERSION_CHANNEL, () => {
    return app.getVersion();
  });

  ipcMain.handle(APP_GET_RUNTIME_INFO_CHANNEL, () => {
    const info: AppRuntimeInfo = {
      platform: process.platform,
      arch: process.arch,
    };
    return info;
  });

  ipcMain.handle(
    APP_FETCH_LATEST_CHANNEL,
    async (_event, rawOptions?: FetchLatestOptions): Promise<FetchLatestResult> => {
      const channel = normalizeChannel(rawOptions);
      try {
        const baseUrl = "https://license.rushmeme.vip/v1/app/latest";
        const url = new URL(baseUrl);
        if (channel) {
          url.searchParams.set("channel", channel);
        }

        const response = await fetch(url.toString(), {
          headers: {
            "Cache-Control": "no-store",
          },
        });

        if (!response.ok) {
          const text = await response.text();
          return {
            ok: false,
            status: response.status,
            message: text || `Latest version request failed (${response.status})`,
          };
        }

        const payload = (await response.json()) as AppLatestRelease;
        if (!payload || typeof payload.version !== "string") {
          return {
            ok: false,
            message: "Latest version payload is invalid",
          };
        }

        return {
          ok: true,
          data: payload,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error when fetching latest version";
        return {
          ok: false,
          message,
        };
      }
    },
  );
}
