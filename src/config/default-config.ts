import { PLATFORM_TEMPLATES, DEFAULT_BROWSER_DELAY } from "./platform-templates";
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

  const normalizedUrls = normalizeUrlTemplates(
    template.urls,
    template.tokenType,
  );

  return {
    ...template,
    id: index === 0 ? template.key : `${template.key}-${index}`,
    accelerator: convertDisplayShortcutToAccelerator(template.shortcut),
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(
        entry.url,
        entry.chain ?? template.tokenType,
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
    browserDelayMs: DEFAULT_BROWSER_DELAY,
    license: createDefaultLicenseSnapshot(),
  };
}
