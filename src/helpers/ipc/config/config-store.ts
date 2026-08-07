import Store from "electron-store";
import type {
  AppConfig,
  AppConfigSavePayload,
  PlatformConfig,
  PlatformTemplate,
  PlatformShortcutConfig,
  RuntimeConfig,
} from "@/types/config";
import {
  createDefaultAppConfig,
  instantiateDefaultPlatforms,
} from "@/config/default-config";
import { PLATFORM_TEMPLATES } from "@/config/platform-templates";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import { extractChainSpecFromUrl, normalizeUrlTemplates } from "@/utils/chain";
type StoredAppConfig = AppConfig;

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
    smartChainCorrectionEnabled: Boolean(
      (config as AppConfig).smartChainCorrectionEnabled,
    ),
    alchemyApiKey:
      typeof (config as AppConfig).alchemyApiKey === "string"
        ? (config as AppConfig).alchemyApiKey.trim()
        : "",
    browserDelayMs: sanitizeBrowserDelay(config.browserDelayMs, 0),
    excludeActiveApp:
      typeof config.excludeActiveApp === "boolean"
        ? config.excludeActiveApp
        : true,
    includeActiveAppOnly:
      typeof config.includeActiveAppOnly === "boolean"
        ? config.includeActiveAppOnly
        : false,
    excludedApps: Array.isArray(config.excludedApps)
      ? [...config.excludedApps]
      : [],
    includedApps: Array.isArray(config.includedApps)
      ? [...config.includedApps]
      : [],
  };
}

function clonePlatformConfig(platform: PlatformConfig): PlatformConfig {
  return {
    ...platform,
    urls: platform.urls.map((entry) => ({ ...entry })),
    shortcuts: platform.shortcuts?.map((entry) => ({ ...entry })) ?? [],
  };
}

function ensurePlatformId(
  platform: PlatformConfig,
  index: number,
): PlatformConfig {
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
      : (template?.urls ?? []);
  const fallbackChain = primaryShortcut.tokenType ?? "";
  const urls = normalizeUrlTemplates(sourceUrls, fallbackChain).map(
    (entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(entry.url, entry.chain ?? fallbackChain),
    }),
  );

  return {
    ...platform,
    variableType: platform.variableType ?? template?.variableType ?? "CA",
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

function normalizeExcludeActiveApp(
  rawValue: unknown,
  fallback: boolean,
): boolean {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  return fallback;
}

type ExtendedConfigLike = Pick<
  AppConfig,
  | "platforms"
  | "notifications"
  | "browserDelayMs"
  | "smartChainCorrectionEnabled"
  | "alchemyApiKey"
  | "excludedApps"
  | "excludeActiveApp"
  | "includedApps"
  | "includeActiveAppOnly"
>;

function normalizeStoredConfig(config: ExtendedConfigLike): StoredAppConfig {
  const defaults = createDefaultAppConfig();
  const templatesByKey = new Map(
    PLATFORM_TEMPLATES.map((template) => [template.key, template]),
  );

  const platformsList = (
    config.platforms?.length ? config.platforms : instantiateDefaultPlatforms()
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
    smartChainCorrectionEnabled:
      typeof (config as { smartChainCorrectionEnabled?: unknown })
        .smartChainCorrectionEnabled === "boolean"
        ? ((config as { smartChainCorrectionEnabled?: boolean })
            .smartChainCorrectionEnabled as boolean)
        : defaults.smartChainCorrectionEnabled,
    alchemyApiKey:
      typeof (config as { alchemyApiKey?: unknown }).alchemyApiKey === "string"
        ? (config as { alchemyApiKey: string }).alchemyApiKey.trim()
        : "",
    excludeActiveApp: normalizeExcludeActiveApp(
      (config as unknown as { excludeActiveApp?: unknown }).excludeActiveApp,
      defaults.excludeActiveApp,
    ),
    excludedApps: normalizeExcludedApps(
      (config as unknown as { excludedApps?: unknown }).excludedApps,
      defaults.excludedApps,
    ),
    includeActiveAppOnly: normalizeExcludeActiveApp(
      (config as unknown as { includeActiveAppOnly?: unknown })
        .includeActiveAppOnly,
      defaults.includeActiveAppOnly,
    ),
    includedApps: normalizeExcludedApps(
      (config as unknown as { includedApps?: unknown }).includedApps,
      defaults.includedApps,
    ),
  };
}

export function getConfig(): RuntimeConfig {
  const storedConfig = store.store;
  const normalized = normalizeStoredConfig(storedConfig);
  store.set(serializeAppConfigForStore(normalized));
  return normalized;
}

export function saveConfig(config: AppConfigSavePayload): AppConfig {
  const normalized = normalizeStoredConfig(config);
  store.set(serializeAppConfigForStore(normalized));
  return normalized;
}
