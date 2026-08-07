export type PlatformUrlTemplate = {
  chain: string;
  url: string;
};

export type PlatformShortcutConfig = {
  tokenType: string;
  shortcut: string;
  accelerator?: string;
};

export type PlatformTemplate = {
  key: string;
  name: string;
  enabled: boolean;
  catalogOnly?: boolean;
  urls: PlatformUrlTemplate[];
  shortcuts: PlatformShortcutConfig[];
  variableType?: "CA" | "ANY";
};

export type PlatformConfig = PlatformTemplate & {
  id: string;
  tokenType?: string;
  shortcut?: string;
  accelerator?: string;
};

export type NotificationConfig = {
  enabled: boolean;
};

export type AppConfig = {
  platforms: PlatformConfig[];
  notifications: NotificationConfig;
  browserDelayMs: number;
  smartChainCorrectionEnabled: boolean;
  alchemyApiKey: string;
  excludeActiveApp: boolean;
  includeActiveAppOnly: boolean;
  excludedApps: string[];
  includedApps: string[];
};

export type RuntimeConfig = AppConfig;

export type AppConfigSavePayload = AppConfig;

export type ExecutePlatformsRequest = {
  overrideAddress?: string;
  bypassAppFilters?: boolean;
};

export type ExecutePlatformsResponse = {
  address?: string;
  opened: string[];
  error?: string;
  success: boolean;
  selectionCaptured?: boolean;
  skippedBecauseExcluded?: boolean;
};
