import { clipboard, shell, Notification, systemPreferences } from "electron";
import { setTimeout as delay } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename } from "node:path";
import type {
  AppConfig,
  ExecutePlatformsRequest,
  ExecutePlatformsResponse,
  PlatformConfig,
} from "@/types/config";
import {
  chainSupportsAddressType,
  resolveUrlForAddress,
  parseChainSpec,
  normalizeChainTokenKey,
  extractAddressesFromText,
  type AddressType,
} from "@/utils/chain";

const execFileAsync = promisify(execFile);

type ActiveApplicationInfo = {
  name?: string;
  bundleId?: string;
  processName?: string;
  executable?: string;
  path?: string;
};

async function getActiveApplicationMac(): Promise<ActiveApplicationInfo | null> {
  const script = `
    tell application "System Events"
      if (count of (processes whose frontmost is true)) = 0 then
        return ""
      end if
      set frontApp to first process whose frontmost is true
      set appName to name of frontApp
      set bundleId to ""
      try
        set bundleId to bundle identifier of frontApp
      end try
      return appName & "::" & bundleId
    end tell
  `.trim();

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    const payload = stdout.trim();
    if (!payload) {
      return null;
    }
    const [rawName = "", rawBundleId = ""] = payload.split("::");
    const name = rawName.trim();
    const bundleId = rawBundleId.trim();
    return {
      name: name || undefined,
      bundleId: bundleId || undefined,
      processName: name || undefined,
      executable: name ? `${name}.app` : undefined,
    };
  } catch (error) {
    console.warn("[rushmeme] failed to resolve frontmost macOS application:", error);
    return null;
  }
}

async function getActiveApplicationWindows(): Promise<ActiveApplicationInfo | null> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$handle = [NativeMethods]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) { return }
$processId = 0
[NativeMethods]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
if ($processId -eq 0) { return }

try {
  $process = Get-Process -Id $processId -ErrorAction Stop
  $path = ""
  try {
    $path = $process.MainModule.FileName
  } catch {
    try {
      $path = $process.Path
    } catch {
      $path = ""
    }
  }
  $line = "{0}::{1}" -f $process.ProcessName, $path
  [Console]::WriteLine($line)
} catch {
}
  `.trim();

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      script,
    ]);
    const payload = stdout.trim();
    if (!payload) {
      return null;
    }
    const [rawProcess = "", rawPath = ""] = payload.split("::");
    const processName = rawProcess.trim();
    const resolvedPath = rawPath.trim();
    const executable = resolvedPath ? basename(resolvedPath) : processName;
    return {
      name: processName || undefined,
      processName: processName || undefined,
      path: resolvedPath || undefined,
      executable: executable || undefined,
    };
  } catch (error) {
    console.warn("[rushmeme] failed to resolve foreground Windows application:", error);
    return null;
  }
}

async function getActiveApplication(): Promise<ActiveApplicationInfo | null> {
  if (process.platform === "darwin") {
    return getActiveApplicationMac();
  }
  if (process.platform === "win32") {
    return getActiveApplicationWindows();
  }
  return null;
}

function collectApplicationCandidates(info: ActiveApplicationInfo | null): string[] {
  if (!info) {
    return [];
  }

  const candidates = new Set<string>();
  const add = (value?: string) => {
    if (value && value.trim()) {
      candidates.add(value.trim());
    }
  };

  add(info.name);
  add(info.bundleId);
  add(info.processName);
  add(info.executable);
  add(info.path);
  if (info.path) {
    add(basename(info.path));
  }

  return Array.from(candidates);
}

type NormalizedExcludedEntry = {
  exact: string;
  sanitized: string;
  length: number;
};

function normalizeExcludedEntries(entries: string[]): NormalizedExcludedEntry[] {
  const seen = new Set<string>();
  const normalized: NormalizedExcludedEntry[] = [];

  for (const entry of entries) {
    const value = entry.trim().toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push({
      exact: value,
      sanitized: value.replace(/(\.app|\.exe)$/i, ""),
      length: value.length,
    });
  }

  return normalized;
}

function isApplicationExcluded(
  info: ActiveApplicationInfo | null,
  excluded: string[],
): boolean {
  if (!info || excluded.length === 0) {
    return false;
  }

  const normalizedExcluded = normalizeExcludedEntries(excluded);
  if (normalizedExcluded.length === 0) {
    return false;
  }

  const candidates = collectApplicationCandidates(info);
  if (candidates.length === 0) {
    return false;
  }

  return candidates.some((candidate) => {
    const raw = candidate.trim();
    if (!raw) {
      return false;
    }
    const lower = raw.toLowerCase();
    const sanitized = lower.replace(/(\.app|\.exe)$/i, "");
    return normalizedExcluded.some((entry) => {
      if (lower === entry.exact) {
        return true;
      }
      if (entry.sanitized && sanitized === entry.sanitized) {
        return true;
      }
      if (lower.endsWith(entry.exact)) {
        return true;
      }
      if (entry.sanitized && sanitized.endsWith(entry.sanitized)) {
        return true;
      }
      if (
        entry.length >= 3 &&
        (lower.includes(entry.exact) ||
          (entry.sanitized && sanitized.includes(entry.sanitized)))
      ) {
        return true;
      }
      return false;
    });
  });
}

type NotificationVariant = "info" | "success" | "error" | "warning";

type ShowNotificationOptions = {
  title: string;
  body: string;
  variant?: NotificationVariant;
  titleEmoji?: string;
};

const DEFAULT_TITLE_EMOJI: Record<NotificationVariant, string | undefined> = {
  info: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
};

function showNotification(options: ShowNotificationOptions) {
  if (!Notification.isSupported()) {
    return;
  }

  const variant = options.variant ?? "info";
  const emoji = options.titleEmoji ?? DEFAULT_TITLE_EMOJI[variant];
  const decoratedTitle =
    emoji && !options.title.startsWith(emoji)
      ? `${emoji} ${options.title}`
      : options.title;

  new Notification({
    title: decoratedTitle,
    body: options.body,
  }).show();
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

      // await delay(10);
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

  const commandIssued = await simulateCopyShortcut();
  if (!commandIssued) {
    clipboard.writeText(original);
    return { captured: false, original };
  }

  const timeoutMs = 1500;
  const intervalMs = 25;
  const started = Date.now();

  let candidate: string | null = null;
  let attempts = 0;

  while (Date.now() - started < timeoutMs) {
    if (attempts > 0) {
      await delay(intervalMs);
    }
    attempts += 1;
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

  const excludedApps = Array.isArray(config.excludedApps)
    ? config.excludedApps
    : [];

  if (excludedApps.length > 0) {
    try {
      const activeApp = await getActiveApplication();
      if (isApplicationExcluded(activeApp, excludedApps)) {
        console.log(
          "[rushmeme] execution skipped: active application is excluded.",
          activeApp,
        );
        return {
          success: false,
          opened,
          error: "Execution skipped because the active application is excluded.",
          selectionCaptured: false,
          skippedBecauseExcluded: true,
        };
      }
    } catch (error) {
      console.warn(
        "[rushmeme] failed to evaluate active application for exclusion:",
        error,
      );
    }
  }

  console.log("[rushmeme] execute action", new Date().toISOString());

  let rawInput = request?.overrideAddress?.trim();
  let selectionCaptured = false;
  let originalClipboardValue: string | null = null;
  const restoreClipboardIfNeeded = () => {
    if (selectionCaptured && typeof originalClipboardValue === "string") {
      clipboard.writeText(originalClipboardValue);
    }
  };

  if (!rawInput) {
    const captureResult = await captureSelectedText();
    if (!captureResult.captured || !captureResult.text) {
      if (captureResult.original) {
        clipboard.writeText(captureResult.original);
      }
      if (config.notifications.enabled) {
        showNotification({
          title: "RushMeme",
          body: "Failed to capture a selection. Highlight a contract address and try again.",
          variant: "error",
        });
      }
      return {
        success: false,
        opened,
        error: "No contract address detected from the current selection.",
        selectionCaptured: false,
      };
    }

    rawInput = captureResult.text;
    selectionCaptured = true;
    originalClipboardValue = captureResult.original;
  }

  if (!rawInput) {
    restoreClipboardIfNeeded();
    return {
      success: false,
      opened,
      error: "No contract address detected from the current selection.",
      selectionCaptured,
    };
  }

  const enabledPlatforms = config.platforms.filter((item) => item.enabled);
  const detectedAddresses = extractAddressesFromText(rawInput);

  if (detectedAddresses.length === 0) {
    restoreClipboardIfNeeded();
    if (config.notifications.enabled) {
      showNotification({
        title: "RushMeme",
        body: "Selected text does not contain a supported contract address.",
        variant: "warning",
        titleEmoji: "🔍",
      });
    }
    return {
      success: false,
      opened,
      error: "Selected text does not contain a supported contract address.",
      selectionCaptured,
    };
  }

  const urlsToOpen = enabledPlatforms.flatMap((platform) =>
    detectedAddresses.flatMap(({ address, type }) =>
      buildPlatformUrls(platform, address, type).map((url) => ({
        url,
        platform,
        address,
      })),
    ),
  );

  if (urlsToOpen.length === 0) {
    if (config.notifications.enabled) {
      showNotification({
        title: "RushMeme",
        body: "No enabled platforms were available for the captured address.",
        variant: "error",
      });
    }
    restoreClipboardIfNeeded();
    return {
      success: false,
      opened,
      address: detectedAddresses[0]?.address,
      error: "No enabled platforms available to open.",
      selectionCaptured,
    };
  }

  if (config.notifications.enabled) {
    const addressSummary =
      detectedAddresses.length === 1
        ? detectedAddresses[0].address
        : `${detectedAddresses.length} addresses`;
    const delayMessage =
      config.browserDelayMs > 0
        ? `Opening ${urlsToOpen.length} destination(s) for ${addressSummary} in ${Math.round(config.browserDelayMs / 100) / 10}s.`
        : `Opening ${urlsToOpen.length} destination(s) for ${addressSummary}.`;
    showNotification({
      title: "RushMeme",
      body: delayMessage,
      variant: "success",
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
    address: detectedAddresses[0]?.address,
    selectionCaptured,
  };
}
