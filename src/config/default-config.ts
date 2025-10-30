import { PLATFORM_TEMPLATES } from "./platform-templates";
import type { AppConfig, LicenseSnapshot, PlatformConfig } from "@/types/config";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import { extractChainSpecFromUrl, normalizeUrlTemplates } from "@/utils/chain";

function instantiatePlatformTemplate(
  templateKey: string,
  index: number,
): PlatformConfig {
  const template = PLATFORM_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) {
    throw new Error(`Unknown platform template: ${templateKey}`);
  }

  const sourceShortcuts = Array.isArray(template.shortcuts)
    ? template.shortcuts
    : [];
  const [primary] = sourceShortcuts;
  const primaryTokenType = primary?.tokenType ?? "Any";

  const normalizedUrls = normalizeUrlTemplates(
    template.urls,
    primaryTokenType,
  );

  const shortcutsWithAccelerators = sourceShortcuts.map((entry) => ({
    ...entry,
    accelerator:
      entry.accelerator ??
      convertDisplayShortcutToAccelerator(entry.shortcut) ??
      undefined,
  }));

  return {
    ...template,
    id: index === 0 ? template.key : `${template.key}-${index}`,
    tokenType: primaryTokenType,
    shortcut: primary?.shortcut ?? "",
    accelerator: convertDisplayShortcutToAccelerator(primary?.shortcut ?? ""),
    shortcuts: shortcutsWithAccelerators,
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(
        entry.url,
        entry.chain ?? primaryTokenType,
      ),
    })),
  };
}

export function instantiateDefaultPlatforms(includeCatalogOnly = false): PlatformConfig[] {
  const templates = includeCatalogOnly
    ? PLATFORM_TEMPLATES
    : PLATFORM_TEMPLATES.filter((template) => !template.catalogOnly);

  return templates.map((template, index) =>
    instantiatePlatformTemplate(template.key, index),
  );
}

export function createDefaultLicenseSnapshot(): LicenseSnapshot {
  return {
    key: null,
    status: "missing",
    deviceId: "",
    deviceName: null,
    issuedTo: null,
    expiresAt: null,
    lastValidatedAt: null,
    nextCheckInAt: null,
    remainingActivations: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

export function createDefaultAppConfig(): AppConfig {
  const platforms = instantiateDefaultPlatforms(false).map((platform, index) => ({
    ...platform,
    enabled: index === 0 ? true : platform.enabled,
  }));

  return {
    platforms,
    notifications: {
      enabled: true,
    },
    browserDelayMs: 0,
    excludedApps: [],
    license: createDefaultLicenseSnapshot(),
  };
}
