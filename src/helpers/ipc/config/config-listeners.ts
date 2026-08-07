import { app, globalShortcut, ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CONFIG_GET_CHANNEL,
  CONFIG_SAVE_CHANNEL,
  PLATFORM_EXECUTE_CHANNEL,
  CONFIG_SHORTCUTS_DISABLE_CHANNEL,
  CONFIG_SHORTCUTS_ENABLE_CHANNEL,
} from "./config-channels";
import { getConfig, saveConfig } from "./config-store";
import { executePlatforms } from "./platform-executor";
import type {
  AppConfig,
  AppConfigSavePayload,
  ExecutePlatformsRequest,
  ExecutePlatformsResponse,
  PlatformConfig,
} from "@/types/config";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";

type ShortcutRegistry = {
  accelerator: string;
  platformId: string;
  shortcutIndex: number;
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
const execFileAsync = promisify(execFile);

let shortcutSuspendCount = 0;
let lastConfig: AppConfig | null = null;

type ConfigListenerOptions = {
  onConfigUpdated?: (config: AppConfig) => void;
};

function buildShortcutRegistry(config: AppConfig): ShortcutRegistry[] {
  const registry: ShortcutRegistry[] = [];
  for (const platform of config.platforms) {
    if (!platform.enabled) {
      continue;
    }
    const shortcuts =
      Array.isArray(platform.shortcuts) && platform.shortcuts.length > 0
        ? platform.shortcuts
        : [
            {
              tokenType: platform.tokenType ?? "",
              shortcut: platform.shortcut ?? "",
              accelerator: platform.accelerator,
            },
          ];

    shortcuts.forEach((entry, index) => {
      if (!entry.shortcut && !entry.accelerator) {
        return;
      }
      const accelerator =
        entry.accelerator ??
        convertDisplayShortcutToAccelerator(entry.shortcut);
      if (!accelerator) {
        return;
      }
      registry.push({
        accelerator,
        platformId: platform.id,
        shortcutIndex: index,
      });
    });
  }
  return registry;
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
  handler:
    | (() => Promise<ExecutePlatformsResponse | void>)
    | (() => ExecutePlatformsResponse | void),
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
        const result = await handler();
        if (result?.skippedBecauseExcluded) {
          await relayAccelerator(accelerator);
        }
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

  const grouped = new Map<string, ShortcutRegistry[]>();
  for (const entry of registry) {
    const existing = grouped.get(entry.accelerator);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.accelerator, [entry]);
    }
  }

  for (const [accelerator, entries] of grouped) {
    try {
      const registered = globalShortcut.register(
        accelerator,
        createSingleFireCallback(accelerator, async () => {
          const currentConfig = lastConfig ?? getConfig();
          if (!lastConfig) {
            lastConfig = currentConfig;
          }
          const selectedPlatforms: PlatformConfig[] = [];
          for (const entry of entries) {
            const platform = currentConfig.platforms.find(
              (item) => item.id === entry.platformId,
            );
            if (!platform || !platform.enabled) {
              continue;
            }
            const shortcuts =
              Array.isArray(platform.shortcuts) && platform.shortcuts.length > 0
                ? platform.shortcuts
                : [
                    {
                      tokenType: platform.tokenType ?? "",
                      shortcut: platform.shortcut ?? "",
                      accelerator: platform.accelerator,
                    },
                  ];
            const selectedShortcut =
              shortcuts[entry.shortcutIndex] ?? shortcuts[0];
            if (!selectedShortcut) {
              continue;
            }
            const resolvedAccelerator =
              selectedShortcut.accelerator ??
              convertDisplayShortcutToAccelerator(selectedShortcut.shortcut) ??
              undefined;
            selectedPlatforms.push({
              ...platform,
              tokenType: selectedShortcut.tokenType ?? platform.tokenType ?? "",
              shortcut: selectedShortcut.shortcut ?? platform.shortcut ?? "",
              accelerator: resolvedAccelerator ?? platform.accelerator,
              shortcuts: shortcuts.map((shortcutEntry, index) =>
                index === entry.shortcutIndex
                  ? {
                      ...shortcutEntry,
                      accelerator: resolvedAccelerator,
                    }
                  : shortcutEntry,
              ),
            });
          }
          if (selectedPlatforms.length === 0) {
            return;
          }
          const platformOnlyConfig: AppConfig = {
            ...currentConfig,
            platforms: selectedPlatforms,
          };
          return executePlatforms(platformOnlyConfig);
        }),
      );
      if (!registered) {
        console.warn(
          `[rushmeme] Could not register system shortcut ${accelerator}; the operating system reports it is already in use.`,
        );
      }
    } catch (error) {
      console.error(`Failed to register shortcut ${accelerator}:`, error);
    }
  }
}

type ParsedAccelerator = {
  key?: string;
  modifiers: string[];
};

const NAMED_KEY_CHAR_MAP: Record<string, string> = {
  comma: ",",
  period: ".",
  dot: ".",
  minus: "-",
  dash: "-",
  equals: "=",
  plus: "+",
  semicolon: ";",
  apostrophe: "'",
  quote: "'",
  bracketleft: "[",
  bracketright: "]",
  backslash: "\\",
  slash: "/",
  forwardslash: "/",
  backquote: "`",
  grave: "`",
  tilde: "`",
  space: " ",
};

const MAC_SPECIAL_KEY_CODES: Record<string, number> = {
  return: 36,
  enter: 76,
  escape: 53,
  esc: 53,
  tab: 48,
  delete: 51,
  backspace: 51,
  forwarddelete: 117,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
};

const MAC_FUNCTION_KEY_CODES: Record<string, number> = {
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
  f13: 105,
  f14: 107,
  f15: 113,
  f16: 106,
  f17: 64,
  f18: 79,
  f19: 80,
};

const WINDOWS_SPECIAL_KEY_MAP: Record<string, string> = {
  enter: "{ENTER}",
  return: "{ENTER}",
  escape: "{ESC}",
  esc: "{ESC}",
  tab: "{TAB}",
  space: "{SPACE}",
  backspace: "{BACKSPACE}",
  delete: "{DELETE}",
  del: "{DELETE}",
  insert: "{INSERT}",
  ins: "{INSERT}",
  home: "{HOME}",
  end: "{END}",
  pageup: "{PGUP}",
  pagedown: "{PGDN}",
  left: "{LEFT}",
  right: "{RIGHT}",
  up: "{UP}",
  down: "{DOWN}",
};

const LINUX_SPECIAL_KEY_MAP: Record<string, string> = {
  enter: "Return",
  return: "Return",
  escape: "Escape",
  esc: "Escape",
  tab: "Tab",
  space: "space",
  backspace: "BackSpace",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  ins: "Insert",
  home: "Home",
  end: "End",
  pageup: "Page_Up",
  pagedown: "Page_Down",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};

const MAC_MODIFIER_ORDER = ["command", "control", "option", "shift"];

function parseAcceleratorParts(accelerator: string): ParsedAccelerator | null {
  if (!accelerator) {
    return null;
  }
  const tokens = accelerator
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  if (tokens.length === 1) {
    return {
      key: tokens[0],
      modifiers: [],
    };
  }

  return {
    key: tokens[tokens.length - 1],
    modifiers: tokens.slice(0, -1).map((token) => token.toLowerCase()),
  };
}

function resolveKeyCharacter(key: string | undefined): string | null {
  if (!key) {
    return null;
  }
  if (key.length === 1) {
    return key;
  }
  const mapped = NAMED_KEY_CHAR_MAP[key.toLowerCase()];
  return mapped ?? null;
}

function mapMacModifiers(modifiers: string[]): string[] {
  const resolved = new Set<string>();
  for (const modifier of modifiers) {
    const mapped = (() => {
      switch (modifier) {
        case "command":
        case "cmd":
        case "commandorcontrol":
        case "super":
        case "meta":
        case "win":
          return "command";
        case "control":
        case "ctrl":
          return "control";
        case "alt":
        case "option":
          return "option";
        case "shift":
          return "shift";
        default:
          return null;
      }
    })();
    if (mapped) {
      resolved.add(mapped);
    }
  }
  return MAC_MODIFIER_ORDER.filter((modifier) => resolved.has(modifier));
}

function escapeAppleScriptLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMacRelayScript(accelerator: string): string | null {
  const parts = parseAcceleratorParts(accelerator);
  if (!parts?.key) {
    return null;
  }

  const modifiers = mapMacModifiers(parts.modifiers);
  const usingClause =
    modifiers.length > 0
      ? ` using {${modifiers.map((item) => `${item} down`).join(", ")}}`
      : "";

  const keyChar = resolveKeyCharacter(parts.key);
  let action: string | null = null;

  if (keyChar && keyChar.length === 1) {
    const literal = escapeAppleScriptLiteral(keyChar.toLowerCase());
    action = `keystroke "${literal}"${usingClause}`;
  } else {
    const normalizedKey = parts.key.toLowerCase();
    const functionKeyCode = MAC_FUNCTION_KEY_CODES[normalizedKey];
    const specialKeyCode =
      functionKeyCode ?? MAC_SPECIAL_KEY_CODES[normalizedKey];

    if (specialKeyCode != null) {
      action = `key code ${specialKeyCode}${usingClause}`;
    } else if (normalizedKey === "space") {
      action = `keystroke " "${usingClause}`;
    }
  }

  if (!action) {
    return null;
  }

  return `
tell application "System Events"
  ${action}
end tell
  `.trim();
}

function buildWindowsSendKeys(accelerator: string): string | null {
  const parts = parseAcceleratorParts(accelerator);
  if (!parts?.key) {
    return null;
  }

  const modifiers = new Set(parts.modifiers);
  let prefix = "";

  if (
    modifiers.has("command") ||
    modifiers.has("commandorcontrol") ||
    modifiers.has("ctrl") ||
    modifiers.has("control")
  ) {
    prefix += "^";
  }
  if (modifiers.has("shift")) {
    prefix += "+";
  }
  if (modifiers.has("alt") || modifiers.has("option")) {
    prefix += "%";
  }
  if (modifiers.has("super") || modifiers.has("meta") || modifiers.has("win")) {
    prefix += "#";
  }

  const normalizedKey = parts.key.toLowerCase();
  const special = WINDOWS_SPECIAL_KEY_MAP[normalizedKey];
  let token: string | null = null;

  if (special) {
    token = special;
  } else {
    const functionMatch = /^f([0-9]{1,2})$/i.exec(parts.key);
    if (functionMatch) {
      const index = Number(functionMatch[1]);
      if (index >= 1 && index <= 24) {
        token = `{F${index}}`;
      }
    }
  }

  if (!token) {
    const char = resolveKeyCharacter(parts.key);
    if (char) {
      const needsBraces = "^+%~(){}[]".includes(char);
      if (needsBraces) {
        if (char === "{") {
          token = "{{}";
        } else if (char === "}") {
          token = "{}}";
        } else {
          token = `{${char}}`;
        }
      } else {
        token = char.length === 1 ? char : null;
      }
    }
  }

  if (!token) {
    const singleChar = parts.key.length === 1 ? parts.key : null;
    if (singleChar && !token) {
      const needsBraces = "^+%~(){}[]".includes(singleChar);
      token = needsBraces ? `{${singleChar}}` : singleChar;
    }
  }

  if (!token) {
    return null;
  }

  return `${prefix}${token}`;
}

function buildLinuxKeySequence(accelerator: string): string | null {
  const parts = parseAcceleratorParts(accelerator);
  if (!parts?.key) {
    return null;
  }

  const modifiers: string[] = [];
  const modifierSet = new Set(parts.modifiers);

  if (
    modifierSet.has("commandorcontrol") ||
    modifierSet.has("control") ||
    modifierSet.has("ctrl")
  ) {
    modifiers.push("ctrl");
  }
  if (modifierSet.has("shift")) {
    modifiers.push("shift");
  }
  if (modifierSet.has("alt") || modifierSet.has("option")) {
    modifiers.push("alt");
  }
  if (
    modifierSet.has("super") ||
    modifierSet.has("meta") ||
    modifierSet.has("win")
  ) {
    modifiers.push("super");
  }

  const normalizedKey = parts.key.toLowerCase();
  let keyToken = LINUX_SPECIAL_KEY_MAP[normalizedKey];

  if (!keyToken) {
    const functionMatch = /^f([0-9]{1,2})$/i.exec(parts.key);
    if (functionMatch) {
      const index = Number(functionMatch[1]);
      if (index >= 1 && index <= 35) {
        keyToken = `F${index}`;
      }
    }
  }

  if (!keyToken) {
    const char = resolveKeyCharacter(parts.key);
    if (char) {
      switch (char) {
        case " ":
          keyToken = "space";
          break;
        case "+":
          keyToken = "plus";
          break;
        case "-":
          keyToken = "minus";
          break;
        case "=":
          keyToken = "equal";
          break;
        case ",":
          keyToken = "comma";
          break;
        case ".":
          keyToken = "period";
          break;
        case "/":
          keyToken = "slash";
          break;
        case "\\":
          keyToken = "backslash";
          break;
        case ";":
          keyToken = "semicolon";
          break;
        case "'":
          keyToken = "apostrophe";
          break;
        case "`":
          keyToken = "grave";
          break;
        case "[":
          keyToken = "bracketleft";
          break;
        case "]":
          keyToken = "bracketright";
          break;
        default:
          if (/^[a-z0-9]$/i.test(char)) {
            keyToken = char.toLowerCase();
          }
          break;
      }
    }
  }

  if (!keyToken) {
    const singleChar = parts.key.length === 1 ? parts.key : null;
    if (singleChar && /^[a-z0-9]$/i.test(singleChar)) {
      keyToken = singleChar.toLowerCase();
    }
  }

  if (!keyToken) {
    return null;
  }

  const sequenceParts = [...modifiers, keyToken];
  return sequenceParts.join("+");
}

async function dispatchAcceleratorToSystem(
  accelerator: string,
): Promise<boolean> {
  try {
    if (process.platform === "darwin") {
      const script = buildMacRelayScript(accelerator);
      if (!script) {
        return false;
      }
      await execFileAsync("osascript", ["-e", script]);
      return true;
    }

    if (process.platform === "win32") {
      const sendKeys = buildWindowsSendKeys(accelerator);
      if (!sendKeys) {
        return false;
      }
      const escaped = sendKeys.replace(/"/g, '""');
      const command = `$wshell = New-Object -ComObject wscript.shell; Start-Sleep -Milliseconds 25; $wshell.SendKeys("${escaped}")`;
      await execFileAsync("powershell", ["-NoProfile", "-Command", command]);
      return true;
    }

    if (process.platform === "linux") {
      const sequence = buildLinuxKeySequence(accelerator);
      if (!sequence) {
        return false;
      }
      const escapedSequence = sequence.replace(
        new RegExp('(["$`\\\\])', "g"),
        "\\$1",
      );
      const command = `command -v xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers "${escapedSequence}"`;
      await execFileAsync("bash", ["-lc", command]);
      return true;
    }
  } catch (error) {
    console.warn(
      `[rushmeme] failed to relay accelerator ${accelerator} to system:`,
      error,
    );
    return false;
  }

  return false;
}

async function relayAccelerator(accelerator: string) {
  if (!accelerator) {
    return;
  }

  const existingState = shortcutStates.get(accelerator);
  if (existingState?.releaseTimer) {
    clearTimeout(existingState.releaseTimer);
    existingState.releaseTimer = undefined;
  }

  shortcutStates.delete(accelerator);

  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  } catch (error) {
    console.warn(
      `[rushmeme] failed to unregister accelerator ${accelerator} before relay:`,
      error,
    );
  }

  await dispatchAcceleratorToSystem(accelerator);

  if (shortcutSuspendCount === 0 && lastConfig) {
    setTimeout(() => {
      if (shortcutSuspendCount === 0 && lastConfig) {
        registerPlatformShortcuts(lastConfig);
      }
    }, 50);
  }
}

export function addConfigEventListeners(
  _mainWindow: BrowserWindow,
  options?: ConfigListenerOptions,
) {
  ipcMain.handle(CONFIG_GET_CHANNEL, () => {
    const config = getConfig();
    return config;
  });

  ipcMain.handle(
    CONFIG_SAVE_CHANNEL,
    (_event, rawConfig: AppConfigSavePayload) => {
      const saved = saveConfig(rawConfig);
      registerPlatformShortcuts(saved);
      options?.onConfigUpdated?.(saved);
      return;
    },
  );

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
    options?.onConfigUpdated?.(config);
  });

  app.on("will-quit", () => {
    unregisterAll();
  });
}
