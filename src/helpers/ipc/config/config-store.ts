import Store from "electron-store";
import type {
  AppConfig,
  PlatformConfig,
  PlatformTemplate,
  RuntimeConfig,
} from "@/types/config";
import { createDefaultAppConfig, instantiateDefaultPlatforms } from "@/config/default-config";
import { PLATFORM_TEMPLATES, DEFAULT_BROWSER_DELAY } from "@/config/platform-templates";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import { extractChainSpecFromUrl, normalizeUrlTemplates } from "@/utils/chain";
import { isProLicensed } from "@/helpers/ipc/license/pro-status";
import {
  getLicenseSnapshot,
  setLicenseSnapshot,
  updateLicenseSnapshot,
  patchLicenseSnapshot,
} from "@/helpers/ipc/license/license-store";

type StoredAppConfig = Omit<AppConfig, "license">;

function createDefaultStoredConfig(): StoredAppConfig {
  const defaults = createDefaultAppConfig();
  return {
    platforms: defaults.platforms,
    notifications: defaults.notifications,
    browserDelayMs: defaults.browserDelayMs,
    excludedApps: defaults.excludedApps,
  };
}

const store = new Store<StoredAppConfig>({
  name: "rushmeme-config",
  defaults: createDefaultStoredConfig(),
});

function ensurePlatformId(platform: PlatformConfig, index: number): PlatformConfig {
  if (platform.id) {
    return platform;
  }

  const baseId = platform.key ?? `platform-${index}`;
  return {
    ...platform,
    id: `${baseId}-${index}`,
  };
}

function ensurePlatformDefaults(
  platform: PlatformConfig,
  template?: PlatformTemplate,
) {
  const resolvedShortcut = platform.shortcut ?? template?.shortcut ?? "";
  const accelerator =
    platform.accelerator ?? convertDisplayShortcutToAccelerator(resolvedShortcut);
  const sourceUrls = platform.urls?.length ? platform.urls : template?.urls ?? [];
  const fallbackChain = platform.tokenType ?? template?.tokenType ?? "";
  const urls = normalizeUrlTemplates(sourceUrls, fallbackChain).map((entry) => ({
    ...entry,
    chain: extractChainSpecFromUrl(entry.url, entry.chain ?? fallbackChain),
  }));

  return {
    ...platform,
    requiresPro: platform.requiresPro ?? template?.requiresPro,
    tokenType: platform.tokenType ?? template?.tokenType ?? "",
    shortcut: resolvedShortcut,
    accelerator,
    urls,
  };
}

function sanitizeBrowserDelay(candidate: unknown, fallback: number): number {
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return fallback;
  }

  const normalized = Math.max(0, Math.round(candidate));
  return normalized;
}

function enforceSingleActivePlatform(
  platforms: PlatformConfig[],
  proLicensed: boolean,
): PlatformConfig[] {
  if (proLicensed) {
    return platforms.map((platform) => ({ ...platform }));
  }

  let hasActivated = false;
  return platforms.map((platform) => {
    if (!platform.enabled) {
      return {
        ...platform,
        enabled: false,
      };
    }

    if (!hasActivated) {
      hasActivated = true;
      return {
        ...platform,
        enabled: true,
      };
    }

    return {
      ...platform,
      enabled: false,
    };
  });
}

function normalizeNotifications(
  rawValue: unknown,
  fallback: { enabled: boolean },
): { enabled: boolean } {
  if (
    rawValue &&
    typeof rawValue === "object" &&
    "enabled" in rawValue &&
    typeof (rawValue as { enabled: unknown }).enabled === "boolean"
  ) {
    return { enabled: (rawValue as { enabled: boolean }).enabled };
  }

  if (
    rawValue &&
    typeof rawValue === "object" &&
    ("success" in rawValue || "error" in rawValue)
  ) {
    const legacy = rawValue as { success?: unknown; error?: unknown };
    const success = typeof legacy.success === "boolean" ? legacy.success : true;
    const error = typeof legacy.error === "boolean" ? legacy.error : true;
    return { enabled: success || error };
  }

  return fallback;
}

function normalizeExcludedApps(
  rawValue: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(rawValue)) {
    return [...fallback];
  }

  const normalized = rawValue
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const entry of normalized) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

type ConfigLike = Pick<AppConfig, "platforms" | "notifications" | "browserDelayMs" | "excludedApps">;

function normalizeStoredConfig(config: ConfigLike): StoredAppConfig {
  const defaults = createDefaultAppConfig();
  const proLicensed = isProLicensed();
  const templatesByKey = new Map(
    PLATFORM_TEMPLATES.map((template) => [template.key, template]),
  );

  const platformsList = config.platforms?.length
    ? config.platforms
        .map((platform, index) => ensurePlatformId(platform, index))
        .map((platform) =>
          ensurePlatformDefaults(platform, templatesByKey.get(platform.key)),
        )
    : instantiateDefaultPlatforms();

  const platforms = enforceSingleActivePlatform(platformsList, proLicensed);

  const browserDelayMs = proLicensed
    ? sanitizeBrowserDelay(config.browserDelayMs ?? defaults.browserDelayMs, defaults.browserDelayMs)
    : DEFAULT_BROWSER_DELAY;

  const notifications = normalizeNotifications(
    (config as unknown as { notifications?: unknown }).notifications,
    defaults.notifications,
  );

  return {
    browserDelayMs,
    notifications,
    platforms,
    excludedApps: normalizeExcludedApps(
      (config as unknown as { excludedApps?: unknown }).excludedApps,
      defaults.excludedApps,
    ),
  };
}

export function getConfig(): RuntimeConfig {
  const storedConfig = store.store;
  const normalized = normalizeStoredConfig(storedConfig);
  store.set(normalized);
  const license = getLicenseSnapshot();

  return {
    ...normalized,
    license,
    isPro: isProLicensed(),
  };
}

export function saveConfig(config: AppConfig): AppConfig {
  const normalized = normalizeStoredConfig(config);
  store.set(normalized);
  const normalizedLicense = config.license
    ? setLicenseSnapshot(config.license)
    : getLicenseSnapshot();
  return {
    ...normalized,
    license: normalizedLicense,
  };
}

export { getLicenseSnapshot, updateLicenseSnapshot, patchLicenseSnapshot };
