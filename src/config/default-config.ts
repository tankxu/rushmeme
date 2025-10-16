import { PLATFORM_TEMPLATES, DEFAULT_BROWSER_DELAY } from "./platform-templates";
import type { AppConfig, PlatformConfig } from "@/types/config";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";

function instantiatePlatformTemplate(
  templateKey: string,
  index: number,
): PlatformConfig {
  const template = PLATFORM_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) {
    throw new Error(`Unknown platform template: ${templateKey}`);
  }

  return {
    ...template,
    id: index === 0 ? template.key : `${template.key}-${index}`,
    accelerator: convertDisplayShortcutToAccelerator(template.shortcut),
    urls: template.urls.map((entry) => ({ ...entry })),
  };
}

export function instantiateDefaultPlatforms(): PlatformConfig[] {
  return PLATFORM_TEMPLATES.map((template, index) =>
    instantiatePlatformTemplate(template.key, index),
  );
}

export function createDefaultAppConfig(): AppConfig {
  const platforms = instantiateDefaultPlatforms().map((platform, index) => ({
    ...platform,
    enabled: index === 0 ? true : platform.enabled,
  }));

  return {
    platforms,
    notifications: {
      success: true,
      error: true,
    },
    browserDelayMs: DEFAULT_BROWSER_DELAY,
  };
}
