export type AppDownloadUrls = Record<string, string>;

export type AppReleaseNotes =
  | string
  | null
  | {
      [locale: string]: unknown;
    };

export type AppLatestRelease = {
  channel?: string | null;
  version: string;
  download_urls?: AppDownloadUrls;
  notes?: AppReleaseNotes;
  force_update?: boolean;
  min_supported_version?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
};

export type AppRuntimeInfo = {
  platform: NodeJS.Platform;
  arch: string;
};
