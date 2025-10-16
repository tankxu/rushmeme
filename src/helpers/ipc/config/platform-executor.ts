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
      await execFileAsync("osascript", [
        "-e",
        'tell application "System Events" to keystroke "c" using {command down}',
      ]);
      return true;
    }
    if (process.platform === "win32") {
      await execFileAsync("powershell", [
        "-Command",
        "$wshell = New-Object -ComObject wscript.shell; Start-Sleep -Milliseconds 30; $wshell.SendKeys('^c')",
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
  const commandIssued = await simulateCopyShortcut();
  if (!commandIssued) {
    return { captured: false, original };
  }

  // await delay(150);

  const current = clipboard.readText();
  const trimmed = current.trim();

  if (!trimmed) {
    return { captured: false, original };
  }

  return { captured: true, text: trimmed, original };
}

function buildPlatformUrls(platform: PlatformConfig, address: string) {
  return platform.urls
    .map((entry) => entry.url.replace("{CA}", encodeURIComponent(address)))
    .filter(Boolean);
}

export async function executePlatforms(
  config: AppConfig,
  request?: ExecutePlatformsRequest,
): Promise<ExecutePlatformsResponse> {
  const opened: string[] = [];

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
      if (config.notifications.error) {
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
  const urlsToOpen = enabledPlatforms.flatMap((platform) =>
    buildPlatformUrls(platform, address).map((url) => ({ url, platform })),
  );

  if (urlsToOpen.length === 0) {
    if (config.notifications.error) {
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

  if (config.notifications.success) {
    const delayMessage =
      config.browserDelayMs > 0
        ? `Opening ${urlsToOpen.length} destination(s) for ${address} in ${Math.round(config.browserDelayMs / 100) / 10}s.`
        : `Opening ${urlsToOpen.length} destination(s) for ${address}.`;
    setTimeout(() => {
      showNotification({
        title: "RushMeme",
        body: delayMessage,
      });
    }, 0);
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
