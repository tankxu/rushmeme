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

type ShortcutState = {
  active: boolean;
  releaseTimer?: NodeJS.Timeout;
  lastInvocationTs?: number;
};

const shortcutStates = new Map<string, ShortcutState>();
const SHORTCUT_RELEASE_BUFFER_MS = 120;
const SHORTCUT_MIN_RELEASE_DELAY_MS = 350;
const SHORTCUT_DEFAULT_RELEASE_DELAY_MS = 1100;

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
  shortcutStates.forEach((state) => {
    if (state.releaseTimer) {
      clearTimeout(state.releaseTimer);
    }
  });
  shortcutStates.clear();
}

function createSingleFireCallback(
  accelerator: string,
  handler: () => Promise<void> | void,
) {
  return async () => {
    let state = shortcutStates.get(accelerator);
    if (!state) {
      state = { active: false };
      shortcutStates.set(accelerator, state);
    }

    const now = Date.now();
    const previousInvocationTs = state.lastInvocationTs;
    state.lastInvocationTs = now;

    const releaseDelay =
      previousInvocationTs != null
        ? Math.max(
            now - previousInvocationTs + SHORTCUT_RELEASE_BUFFER_MS,
            SHORTCUT_MIN_RELEASE_DELAY_MS,
          )
        : SHORTCUT_DEFAULT_RELEASE_DELAY_MS;

    if (!state.active) {
      state.active = true;
      try {
        await handler();
      } catch (error) {
        console.error(
          `[rushmeme] global shortcut handler for ${accelerator} failed:`,
          error,
        );
      }
    }

    if (state.releaseTimer) {
      clearTimeout(state.releaseTimer);
    }
    state.releaseTimer = setTimeout(() => {
      state.active = false;
      state.releaseTimer = undefined;
      state.lastInvocationTs = undefined;
    }, releaseDelay);
  };
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
      const registered = globalShortcut.register(
        entry.accelerator,
        createSingleFireCallback(entry.accelerator, async () => {
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
        }),
      );
      if (!registered) {
        console.warn(
          `[rushmeme] Failed to register shortcut ${entry.accelerator} (already in use)`,
        );
      }
    } catch (error) {
      console.error(
        `Failed to register shortcut ${entry.accelerator} for platform ${entry.platformId}:`,
        error,
      );
    }
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
      unregisterAll();
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
