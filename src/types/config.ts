export type PlatformUrlTemplate = {
  chain: string;
  url: string;
};

export type PlatformTemplate = {
  key: string;
  name: string;
  tokenType: string;
  shortcut: string;
  enabled: boolean;
  requiresPro?: boolean;
  urls: PlatformUrlTemplate[];
};

export type PlatformConfig = PlatformTemplate & {
  id: string;
  accelerator?: string;
};

export type NotificationConfig = {
  success: boolean;
  error: boolean;
};

export type AppConfig = {
  platforms: PlatformConfig[];
  notifications: NotificationConfig;
  browserDelayMs: number;
};

export type ExecutePlatformsRequest = {
  overrideAddress?: string;
};

export type ExecutePlatformsResponse = {
  address?: string;
  opened: string[];
  error?: string;
  success: boolean;
  selectionCaptured?: boolean;
};
