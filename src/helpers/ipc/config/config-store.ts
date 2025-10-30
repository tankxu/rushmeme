import Store from "electron-store";
import type {
  AppConfig,
  AppConfigSavePayload,
  PlatformConfig,
  PlatformTemplate,
  PlatformShortcutConfig,
  RuntimeConfig,
} from "@/types/config";
import { createDefaultAppConfig, instantiateDefaultPlatforms } from "@/config/default-config";
import { PLATFORM_TEMPLATES, DEFAULT_BROWSER_DELAY } from "@/config/platform-templates";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import { extractChainSpecFromUrl, normalizeUrlTemplates } from "@/utils/chain";
import { isProLicensed } from "@/helpers/ipc/license/pro-status";
import {
  getLicenseSnapshot,
  updateLicenseSnapshot,
  patchLicenseSnapshot,
} from "@/helpers/ipc/license/license-store";

type StoredAppConfig = Omit<AppConfig, "license">;

function createDefaultStoredConfig(): StoredAppConfig {
  const defaults = createDefaultAppConfig();
  return serializeAppConfigForStore(defaults);
}

const store = new Store<StoredAppConfig>({
  name: "rushmeme-config",
  defaults: createDefaultStoredConfig(),
});

function sanitizePlatformShortcuts(
  platform: {
    shortcuts?: PlatformShortcutConfig[];
    tokenType?: string;
    shortcut?: string;
    accelerator?: string;
  },
  template?: PlatformTemplate,
): PlatformShortcutConfig[] {
  const templateShortcuts = template?.shortcuts ?? [];
  const sourceShortcuts =
    Array.isArray(platform.shortcuts) && platform.shortcuts.length > 0
      ? platform.shortcuts
      : [];

  const buildEntry = (
    entry: PlatformShortcutConfig | undefined,
    fallback: PlatformShortcutConfig | undefined,
  ): PlatformShortcutConfig => {
    const tokenType = (entry?.tokenType ?? fallback?.tokenType ?? "").trim();
    const shortcut = entry?.shortcut ?? fallback?.shortcut ?? "";
    const accelerator =
      entry?.accelerator ??
      convertDisplayShortcutToAccelerator(shortcut) ??
      undefined;
    return {
      tokenType,
      shortcut,
      accelerator,
    };
  };

  if (sourceShortcuts.length > 0) {
    return sourceShortcuts.map((entry, index) =>
      buildEntry(entry, templateShortcuts[index] ?? templateShortcuts[0]),
    );
  }

  const fallback =
    templateShortcuts[0] ??
    ({
      tokenType: platform.tokenType ?? "",
      shortcut: platform.shortcut ?? "",
      accelerator:
        platform.accelerator ??
        convertDisplayShortcutToAccelerator(platform.shortcut) ??
        undefined,
    } satisfies PlatformShortcutConfig);

  return [buildEntry(undefined, fallback)];
}

function serializePlatformForStore(platform: PlatformConfig): PlatformConfig {
  const sanitized: PlatformConfig = {
    ...platform,
    urls: platform.urls.map((entry) => ({ ...entry })),
    shortcuts: platform.shortcuts?.map((entry) => ({ ...entry })) ?? [],
  };
  sanitized.tokenType = undefined;
  sanitized.shortcut = undefined;
  sanitized.accelerator = undefined;
  return sanitized;
}

function serializeAppConfigForStore(
  config: AppConfig | StoredAppConfig,
): StoredAppConfig {
  return {
    platforms: config.platforms.map(serializePlatformForStore),
    notifications: config.notifications,
    browserDelayMs: 0,
    excludedApps: [...config.excludedApps],
  };
}

function clonePlatformConfig(platform: PlatformConfig): PlatformConfig {
  return {
    ...platform,
    urls: platform.urls.map((entry) => ({ ...entry })),
    shortcuts: platform.shortcuts?.map((entry) => ({ ...entry })) ?? [],
  };
}

function cloneStoredConfig(config: StoredAppConfig): StoredAppConfig {
  return {
    browserDelayMs: config.browserDelayMs,
    notifications: { ...config.notifications },
    platforms: config.platforms.map(clonePlatformConfig),
    excludedApps: [...config.excludedApps],
  };
}

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
  const resolvedShortcuts = sanitizePlatformShortcuts(platform, template);
  const [primaryShortcut = { tokenType: "", shortcut: "", accelerator: "" }] =
    resolvedShortcuts;
  const sourceUrls =
    platform.urls?.length && platform.urls.length > 0
      ? platform.urls
      : template?.urls ?? [];
  const fallbackChain = primaryShortcut.tokenType ?? "";
  const urls = normalizeUrlTemplates(sourceUrls, fallbackChain).map((entry) => ({
    ...entry,
    chain: extractChainSpecFromUrl(entry.url, entry.chain ?? fallbackChain),
  }));

  return {
    ...platform,
    requiresPro: platform.requiresPro ?? template?.requiresPro,
    variableType:
      platform.variableType ?? template?.variableType ?? "CA",
    tokenType: primaryShortcut.tokenType,
    shortcut: primaryShortcut.shortcut,
    accelerator: primaryShortcut.accelerator,
    shortcuts: resolvedShortcuts,
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
  const templatesByKey = new Map(
    PLATFORM_TEMPLATES.map((template) => [template.key, template]),
  );

  const platformsList = (config.platforms?.length
    ? config.platforms
    : instantiateDefaultPlatforms()
  ).map((platform, index) =>
    ensurePlatformDefaults(
      ensurePlatformId(platform, index),
      templatesByKey.get(platform.key),
    ),
  );

  const platforms = platformsList.map(clonePlatformConfig);

  const browserDelayMs = sanitizeBrowserDelay(
    (config as unknown as { browserDelayMs?: unknown }).browserDelayMs ??
      defaults.browserDelayMs,
    defaults.browserDelayMs,
  );

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

function applyRuntimeProOverrides(
  config: StoredAppConfig,
  proLicensed: boolean,
): StoredAppConfig {
  const cloned = cloneStoredConfig(config);
  if (proLicensed) {
    return cloned;
  }

  let hasActivated = false;
  const limitedPlatforms = cloned.platforms.map((platform) => {
    const sourceShortcut =
      platform.shortcuts?.[0] ??
      ({
        tokenType: platform.tokenType ?? "",
        shortcut: platform.shortcut ?? "",
        accelerator: platform.accelerator,
      } satisfies PlatformShortcutConfig);

    const primaryShortcut: PlatformShortcutConfig = {
      tokenType: sourceShortcut.tokenType?.trim() ?? "",
      shortcut: sourceShortcut.shortcut ?? "",
      accelerator:
        sourceShortcut.accelerator ??
        convertDisplayShortcutToAccelerator(sourceShortcut.shortcut ?? "") ??
        undefined,
    };

    const enabled =
      platform.enabled && !hasActivated ? ((hasActivated = true), true) : false;

    return {
      ...platform,
      enabled,
      variableType: platform.variableType ?? "CA",
      tokenType: primaryShortcut.tokenType,
      shortcut: primaryShortcut.shortcut,
      accelerator: primaryShortcut.accelerator,
      shortcuts: [primaryShortcut],
    };
  });

  return {
    ...cloned,
    platforms: limitedPlatforms,
    browserDelayMs: DEFAULT_BROWSER_DELAY,
    excludedApps: [],
  };
}

function mergeProOnlySettings(
  existing: StoredAppConfig,
  incoming: StoredAppConfig,
  proLicensed: boolean,
): StoredAppConfig {
  if (proLicensed) {
    return incoming;
  }

  const previousById = new Map<string, PlatformConfig>(
    existing.platforms.map((platform) => [platform.id, platform]),
  );

  const mergedPlatforms = incoming.platforms.map((platform) => {
    const previous = previousById.get(platform.id);
    if (!previous) {
      return platform;
    }

    const existingShortcuts =
      previous.shortcuts?.map((entry) => ({ ...entry })) ?? [];
    if (existingShortcuts.length === 0) {
      return platform;
    }

    const incomingPrimary =
      platform.shortcuts?.[0] ??
      ({
        tokenType: platform.tokenType ?? "",
        shortcut: platform.shortcut ?? "",
        accelerator: platform.accelerator,
      } satisfies PlatformShortcutConfig);

    const nextShortcuts = existingShortcuts.map((entry, index) => {
      if (index === 0) {
        return {
          ...entry,
          tokenType: incomingPrimary.tokenType,
          shortcut: incomingPrimary.shortcut,
          accelerator:
            incomingPrimary.accelerator ??
            convertDisplayShortcutToAccelerator(
              incomingPrimary.shortcut ?? "",
            ) ??
            entry.accelerator,
        };
      }
      return entry;
    });

    const primary = nextShortcuts[0] ?? incomingPrimary;

    return {
      ...platform,
      enabled:
        previous.enabled && !platform.enabled ? previous.enabled : platform.enabled,
      shortcuts: nextShortcuts,
      tokenType: primary.tokenType,
      shortcut: primary.shortcut,
      accelerator: primary.accelerator,
    };
  });

  return {
    ...incoming,
    platforms: mergedPlatforms,
    browserDelayMs: existing.browserDelayMs,
    excludedApps: [...existing.excludedApps],
  };
}

export function getConfig(): RuntimeConfig {
  const storedConfig = store.store;
  const normalized = normalizeStoredConfig(storedConfig);
  store.set(serializeAppConfigForStore(normalized));
  const proLicensed = isProLicensed();
  const runtimeConfig = applyRuntimeProOverrides(normalized, proLicensed);
  const license = getLicenseSnapshot();
  return {
    ...runtimeConfig,
    license,
    isPro: proLicensed,
  };
}

export function saveConfig(config: AppConfigSavePayload): AppConfig {
  const proLicensed = isProLicensed();
  const existing = normalizeStoredConfig(store.store);
  const normalized = normalizeStoredConfig(config);
  const merged = mergeProOnlySettings(existing, normalized, proLicensed);
  store.set(serializeAppConfigForStore(merged));
  const normalizedLicense = getLicenseSnapshot();
  const runtimeConfig = applyRuntimeProOverrides(merged, proLicensed);
  return {
    ...runtimeConfig,
    license: normalizedLicense,
  };
}

export { getLicenseSnapshot, updateLicenseSnapshot, patchLicenseSnapshot };
