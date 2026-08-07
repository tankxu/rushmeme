import { app, ipcMain } from "electron";
import {
  APP_FETCH_LATEST_CHANNEL,
  APP_GET_RUNTIME_INFO_CHANNEL,
  APP_GET_VERSION_CHANNEL,
} from "./app-channels";
import type { AppLatestRelease, AppRuntimeInfo } from "@/types/app";

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

type GitHubRelease = {
  tag_name?: string;
  body?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

function getDownloadKey(assetName: string): string {
  const name = assetName.toLowerCase();
  const arch = /arm64|aarch64/.test(name)
    ? "arm64"
    : /x64|amd64|x86_64/.test(name)
      ? "x64"
      : "";
  const platform = /\.dmg$|darwin|macos|mac[-_.]/.test(name)
    ? "mac"
    : /\.exe$|\.msi$|win(dows)?/.test(name)
      ? "windows"
      : /\.deb$|\.rpm$|appimage|linux/.test(name)
        ? "linux"
        : assetName;
  return arch && platform !== assetName ? `${platform}-${arch}` : platform;
}

function normalizeGitHubRelease(
  release: GitHubRelease,
): AppLatestRelease | null {
  const version = release.tag_name?.trim().replace(/^v/i, "");
  if (!version) {
    return null;
  }

  const downloadUrls = Object.fromEntries(
    (release.assets ?? []).flatMap((asset) => {
      const name = asset.name?.trim();
      const url = asset.browser_download_url?.trim();
      return name && url ? [[getDownloadKey(name), url] as const] : [];
    }),
  );
  const publishedAt = release.published_at ?? release.created_at ?? null;
  const timestamp = publishedAt ? Date.parse(publishedAt) : Number.NaN;

  return {
    channel: "stable",
    version,
    download_urls: downloadUrls,
    notes: release.body ?? null,
    force_update: false,
    created_at: Number.isFinite(timestamp) ? timestamp : null,
    updated_at: Number.isFinite(timestamp) ? timestamp : null,
  };
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
    async (): Promise<FetchLatestResult> => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/tankxu/rushmeme/releases/latest",
          {
            headers: {
              "Cache-Control": "no-store",
              Accept: "application/vnd.github+json",
              "User-Agent": "RushMeme",
            },
          },
        );

        if (!response.ok) {
          const text = await response.text();
          return {
            ok: false,
            status: response.status,
            message:
              text || `Latest version request failed (${response.status})`,
          };
        }

        const payload = normalizeGitHubRelease(
          (await response.json()) as GitHubRelease,
        );
        if (!payload) {
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
          error instanceof Error
            ? error.message
            : "Unknown error when fetching latest version";
        return {
          ok: false,
          message,
        };
      }
    },
  );
}
