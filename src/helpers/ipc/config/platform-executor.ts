import { clipboard, shell, Notification, systemPreferences } from "electron";
import { setTimeout as delay } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  AppConfig,
  ExecutePlatformsRequest,
  ExecutePlatformsResponse,
  PlatformConfig,
} from "@/types/config";
import {
  chainSupportsAddressType,
  detectAddressType,
  resolveUrlForAddress,
  parseChainSpec,
  normalizeChainTokenKey,
  type AddressType,
} from "@/utils/chain";

const execFileAsync = promisify(execFile);

function showNotification(options: { title: string; body: string }) {
  if (!Notification.isSupported()) {
    return;
  }

  new Notification(options).show();
}

async function simulateCopyShortcut() {
  try {
    if (process.platform === "darwin") {
      try {
        systemPreferences.isTrustedAccessibilityClient(true);
      } catch (error) {
        console.warn(
          "[rushmeme] Accessibility permission check failed:",
          error,
        );
      }
      const script = `
        tell application "System Events"
          key up shift
          key up option
          key up control
          delay 0.01
          keystroke "c" using {command down}
        end tell
      `.trim();
      await execFileAsync("osascript", ["-e", script]);
      console.log("[rushmeme] execute copy shortcut", new Date().toISOString());

      await delay(100);
      console.log(clipboard.readText());

      return true;
    }
    if (process.platform === "win32") {
      await execFileAsync("powershell", [
        "-Command",
        "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('{SHIFT UP}{MENU UP}{CONTROL UP}'); Start-Sleep -Milliseconds 20; $wshell.SendKeys('^c')",
      ]);
      return true;
    }
    if (process.platform === "linux") {
      await execFileAsync("bash", [
        "-lc",
        "command -v xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers ctrl+c",
      ]);
      return true;
    }
  } catch (error) {
    console.warn("[rushmeme] simulate copy failed:", error);
    return false;
  }

  return false;
}

async function captureSelectedText(): Promise<{
  captured: boolean;
  text?: string;
  original: string;
}> {
  const original = clipboard.readText();
  const sentinel = `__rushmeme_selection_sentinel__${Date.now()}_${Math.random().toString(36).slice(2)}`;

  clipboard.writeText(sentinel);
  console.log("[rushmeme] execute action 2", new Date().toISOString());

  const commandIssued = await simulateCopyShortcut();
  if (!commandIssued) {
    clipboard.writeText(original);
    return { captured: false, original };
  }

  const timeoutMs = 1500;
  const intervalMs = 25;
  const started = Date.now();

  let candidate: string | null = null;

  while (Date.now() - started < timeoutMs) {
    await delay(intervalMs);
    try {
      const current = clipboard.readText();
      if (current && current !== sentinel) {
        candidate = current;
        break;
      }
    } catch (error) {
      console.warn("[rushmeme] clipboard read failed:", error);
    }

    try {
      const selectionClipboard = clipboard.readText("selection");
      if (selectionClipboard && selectionClipboard !== sentinel) {
        candidate = selectionClipboard;
        break;
      }
    } catch {
      // the "selection" clipboard is not available on all platforms; ignore errors
    }
  }

  if (!candidate) {
    try {
      const current = clipboard.readText();
      if (current && current !== sentinel) {
        candidate = current;
      }
    } catch {
      candidate = null;
    }
  }

  if (!candidate || !candidate.trim() || candidate === sentinel) {
    clipboard.writeText(original);
    return { captured: false, original };
  }

  const trimmed = candidate.trim();

  try {
    clipboard.writeText(candidate);
  } catch (error) {
    console.warn("[rushmeme] clipboard restore of selection failed:", error);
  }

  return { captured: true, text: trimmed, original };
}

function buildPlatformUrls(
  platform: PlatformConfig,
  address: string,
  addressType: AddressType,
) {
  const allowedTokens = new Set(
    parseChainSpec(platform.tokenType ?? "")
      .map((token) => normalizeChainTokenKey(token))
      .filter(Boolean),
  );
  const allowAllTokens = allowedTokens.size === 0 || allowedTokens.has("any");

  return platform.urls
    .filter((entry) => {
      if (!chainSupportsAddressType(entry.chain, addressType)) {
        return false;
      }

      if (allowAllTokens) {
        return true;
      }

      const entryTokens = parseChainSpec(entry.chain)
        .map((token) => normalizeChainTokenKey(token))
        .filter(Boolean);

      if (entryTokens.length === 0 || entryTokens.includes("any")) {
        return true;
      }

      return entryTokens.some((token) => allowedTokens.has(token));
    })
    .map((entry) => {
      const resolvedUrl = resolveUrlForAddress(
        entry.url,
        entry.chain,
        addressType,
      );
      return resolvedUrl.replace("{CA}", encodeURIComponent(address));
    })
    .filter(Boolean);
}

export async function executePlatforms(
  config: AppConfig,
  request?: ExecutePlatformsRequest,
): Promise<ExecutePlatformsResponse> {
  const opened: string[] = [];

  console.log("[rushmeme] execute action", new Date().toISOString());

  let address = request?.overrideAddress?.trim();
  let selectionCaptured = false;
  let originalClipboardValue: string | null = null;
  const restoreClipboardIfNeeded = () => {
    if (selectionCaptured && typeof originalClipboardValue === "string") {
      clipboard.writeText(originalClipboardValue);
    }
  };

  if (!address) {
    const captureResult = await captureSelectedText();
    if (!captureResult.captured || !captureResult.text) {
      if (captureResult.original) {
        clipboard.writeText(captureResult.original);
      }
      if (config.notifications.enabled) {
        showNotification({
          title: "RushMeme",
          body: "Failed to capture a selection. Highlight a contract address and try again.",
        });
      }
      return {
        success: false,
        opened,
        error: "No contract address detected from the current selection.",
        selectionCaptured: false,
      };
    }

    address = captureResult.text;
    selectionCaptured = true;
    originalClipboardValue = captureResult.original;
  }

  if (!address) {
    restoreClipboardIfNeeded();
    return {
      success: false,
      opened,
      error: "No contract address detected from the current selection.",
      selectionCaptured,
    };
  }

  const enabledPlatforms = config.platforms.filter((item) => item.enabled);
  const addressType = detectAddressType(address);
  const urlsToOpen = enabledPlatforms.flatMap((platform) =>
    buildPlatformUrls(platform, address, addressType).map((url) => ({
      url,
      platform,
    })),
  );

  if (urlsToOpen.length === 0) {
    if (config.notifications.enabled) {
      showNotification({
        title: "RushMeme",
        body: "No enabled platforms were available for the captured address.",
      });
    }
    restoreClipboardIfNeeded();
    return {
      success: false,
      opened,
      address,
      error: "No enabled platforms available to open.",
      selectionCaptured,
    };
  }

  if (config.notifications.enabled) {
    const delayMessage =
      config.browserDelayMs > 0
        ? `Opening ${urlsToOpen.length} destination(s) for ${address} in ${Math.round(config.browserDelayMs / 100) / 10}s.`
        : `Opening ${urlsToOpen.length} destination(s) for ${address}.`;
    showNotification({
      title: "RushMeme",
      body: delayMessage,
    });
  }

  if (config.browserDelayMs > 0) {
    await delay(config.browserDelayMs);
  }

  await Promise.all(
    urlsToOpen.map(async ({ url }) => {
      await shell.openExternal(url);
      opened.push(url);
    }),
  );

  restoreClipboardIfNeeded();

  return {
    success: opened.length > 0,
    opened,
    address,
    selectionCaptured,
  };
}
