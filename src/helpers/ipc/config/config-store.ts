import Store from "electron-store";
import type { AppConfig, PlatformConfig } from "@/types/config";
import { createDefaultAppConfig, instantiateDefaultPlatforms } from "@/config/default-config";
import { PLATFORM_TEMPLATES } from "@/config/platform-templates";
import type { PlatformTemplate } from "@/types/config";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";

const store = new Store<AppConfig>({
  name: "rushmeme-config",
  defaults: createDefaultAppConfig(),
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

function ensurePlatformDefaults(platform: PlatformConfig, template?: PlatformTemplate) {
  const resolvedShortcut =
    platform.shortcut ?? template?.shortcut ?? "";
  const accelerator =
    platform.accelerator ?? convertDisplayShortcutToAccelerator(resolvedShortcut);

  return {
    ...platform,
    requiresPro: platform.requiresPro ?? template?.requiresPro,
    shortcut: resolvedShortcut,
    accelerator,
    urls: platform.urls?.map((entry) => ({ ...entry })) ??
      template?.urls.map((entry) => ({ ...entry })) ??
      [],
  };
}

function normalizeConfig(config: AppConfig): AppConfig {
  const defaults = createDefaultAppConfig();
  const templatesByKey = new Map(
    PLATFORM_TEMPLATES.map((template) => [template.key, template]),
  );

  const platforms = config.platforms?.length
    ? config.platforms
        .map((platform, index) => ensurePlatformId(platform, index))
        .map((platform) =>
          ensurePlatformDefaults(platform, templatesByKey.get(platform.key)),
        )
    : instantiateDefaultPlatforms();

  return {
    browserDelayMs: config.browserDelayMs ?? defaults.browserDelayMs,
    notifications: config.notifications ?? defaults.notifications,
    platforms,
  };
}

export function getConfig(): AppConfig {
  const config = store.store;
  return normalizeConfig(config);
}

export function saveConfig(config: AppConfig) {
  const normalized = normalizeConfig(config);
  store.set(normalized);
  return normalized;
}
