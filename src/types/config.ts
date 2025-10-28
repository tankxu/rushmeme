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
  catalogOnly?: boolean;
  requiresPro?: boolean;
  urls: PlatformUrlTemplate[];
};

export type PlatformConfig = PlatformTemplate & {
  id: string;
  accelerator?: string;
};

export type NotificationConfig = {
  enabled: boolean;
};

export type LicenseStatus =
  | "unknown"
  | "missing"
  | "pending"
  | "active"
  | "suspended"
  | "revoked"
  | "blocked"
  | "expired"
  | "error";

export type LicenseSnapshot = {
  key: string | null;
  status: LicenseStatus;
  deviceId: string;
  deviceName?: string | null;
  issuedTo?: string | null;
  expiresAt?: string | null;
  lastValidatedAt?: string | null;
  nextCheckInAt?: string | null;
  remainingActivations?: number | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
};

export type AppConfig = {
  platforms: PlatformConfig[];
  notifications: NotificationConfig;
  browserDelayMs: number;
  excludedApps: string[];
  license: LicenseSnapshot;
};

export type RuntimeConfig = AppConfig & {
  isPro: boolean;
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
  skippedBecauseExcluded?: boolean;
};
