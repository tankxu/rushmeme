import { app, globalShortcut, ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import {
  CONFIG_GET_CHANNEL,
  CONFIG_SAVE_CHANNEL,
  PLATFORM_EXECUTE_CHANNEL,
  CONFIG_SHORTCUTS_DISABLE_CHANNEL,
  CONFIG_SHORTCUTS_ENABLE_CHANNEL,
} from "./config-channels";
import { getConfig, saveConfig } from "./config-store";
import { executePlatforms } from "./platform-executor";
import type { AppConfig, ExecutePlatformsRequest } from "@/types/config";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";

type ShortcutRegistry = {
  accelerator: string;
  platformId: string;
};

let shortcutSuspendCount = 0;
let lastConfig: AppConfig | null = null;

function buildShortcutRegistry(config: AppConfig): ShortcutRegistry[] {
  return config.platforms
    .map((platform) => {
      if (!platform.shortcut && !platform.accelerator) {
        return null;
      }
      const accelerator =
        platform.accelerator ??
        convertDisplayShortcutToAccelerator(platform.shortcut);
      if (!accelerator) {
        return null;
      }
      return { accelerator, platformId: platform.id };
    })
    .filter((entry): entry is ShortcutRegistry => entry !== null);
}

function unregisterAll() {
  globalShortcut.unregisterAll();
}

function registerPlatformShortcuts(config: AppConfig) {
  lastConfig = config;

  if (!app.isReady()) {
    app.once("ready", () => registerPlatformShortcuts(config));
    return;
  }

  if (shortcutSuspendCount > 0) {
    return;
  }

  unregisterAll();
  const registry = buildShortcutRegistry(config);

  for (const entry of registry) {
    try {
      globalShortcut.register(entry.accelerator, async () => {
        const currentConfig = getConfig();
        const platform = currentConfig.platforms.find(
          (item) => item.id === entry.platformId,
        );
        if (!platform || !platform.enabled) {
          return;
        }
        const platformOnlyConfig: AppConfig = {
          ...currentConfig,
          platforms: [platform],
        };
        await executePlatforms(platformOnlyConfig);
      });
    } catch (error) {
      console.error(
        `Failed to register shortcut ${entry.accelerator} for platform ${entry.platformId}:`,
        error,
      );
    }
  }

  const masterShortcut = "CommandOrControl+Shift+C";
  try {
    globalShortcut.register(masterShortcut, async () => {
      const currentConfig = getConfig();
      await executePlatforms(currentConfig);
    });
  } catch (error) {
    console.error(`Failed to register master shortcut ${masterShortcut}:`, error);
  }
}

export function addConfigEventListeners(_mainWindow: BrowserWindow) {
  ipcMain.handle(CONFIG_GET_CHANNEL, () => {
    const config = getConfig();
    return config;
  });

  ipcMain.handle(CONFIG_SAVE_CHANNEL, (_event, rawConfig: AppConfig) => {
    const saved = saveConfig(rawConfig);
    registerPlatformShortcuts(saved);
    return;
  });

  ipcMain.handle(
    PLATFORM_EXECUTE_CHANNEL,
    async (_event, request: ExecutePlatformsRequest | undefined) => {
      const config = getConfig();
      return executePlatforms(config, request);
    },
  );

  ipcMain.on(CONFIG_SHORTCUTS_DISABLE_CHANNEL, (event) => {
    shortcutSuspendCount += 1;
    unregisterAll();
    event.returnValue = true;
  });

  ipcMain.on(CONFIG_SHORTCUTS_ENABLE_CHANNEL, (event) => {
    shortcutSuspendCount = Math.max(shortcutSuspendCount - 1, 0);
    if (shortcutSuspendCount === 0 && lastConfig) {
      registerPlatformShortcuts(lastConfig);
    }
    event.returnValue = true;
  });

  app.whenReady().then(() => {
    const config = getConfig();
    lastConfig = config;
    registerPlatformShortcuts(config);
  });

  app.on("will-quit", () => {
    unregisterAll();
  });
}
