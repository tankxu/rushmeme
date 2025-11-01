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
  resolveUrlForAddress,
  parseChainSpec,
  normalizeChainTokenKey,
  extractAddressesFromText,
  type AddressType,
} from "@/utils/chain";
import {
  getActiveApplication,
  collectApplicationCandidates,
  type ActiveApplicationInfo,
} from "./active-application";

const execFileAsync = promisify(execFile);

type NormalizedApplicationEntry = {
  exact: string;
  sanitized: string;
  length: number;
};

function normalizeApplicationEntries(
  entries: string[],
): NormalizedApplicationEntry[] {
  const seen = new Set<string>();
  const normalized: NormalizedApplicationEntry[] = [];

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

type ApplicationMatchReason =
  | "exact"
  | "sanitized"
  | "endsWith"
  | "sanitizedEndsWith"
  | "includes";

type ApplicationMatchFailure =
  | "noInfo"
  | "noEntries"
  | "noCandidates"
  | "notMatched";

type ApplicationMatchResult =
  | {
      matched: true;
      reason: ApplicationMatchReason;
      candidate: string;
      entry: NormalizedApplicationEntry;
      candidates: string[];
      normalizedEntries: NormalizedApplicationEntry[];
    }
  | {
      matched: false;
      reason: ApplicationMatchFailure;
      candidates: string[];
      normalizedEntries: NormalizedApplicationEntry[];
    };

function matchApplication(
  info: ActiveApplicationInfo | null,
  entries: string[],
): ApplicationMatchResult {
  if (!info) {
    return {
      matched: false,
      reason: "noInfo",
      candidates: [],
      normalizedEntries: [],
    };
  }

  const normalizedEntries = normalizeApplicationEntries(entries);
  if (normalizedEntries.length === 0) {
    return {
      matched: false,
      reason: "noEntries",
      candidates: [],
      normalizedEntries,
    };
  }

  const candidates = collectApplicationCandidates(info);
  if (candidates.length === 0) {
    return {
      matched: false,
      reason: "noCandidates",
      candidates: [],
      normalizedEntries,
    };
  }

  for (const candidate of candidates) {
    const raw = candidate.trim();
    if (!raw) {
      continue;
    }
    const lower = raw.toLowerCase();
    const sanitized = lower.replace(/(\.app|\.exe)$/i, "");
    for (const entry of normalizedEntries) {
      if (lower === entry.exact) {
        return {
          matched: true,
          reason: "exact",
          candidate: raw,
          entry,
          candidates,
          normalizedEntries,
        };
      }
      if (entry.sanitized && sanitized === entry.sanitized) {
        return {
          matched: true,
          reason: "sanitized",
          candidate: raw,
          entry,
          candidates,
          normalizedEntries,
        };
      }
      if (lower.endsWith(entry.exact)) {
        return {
          matched: true,
          reason: "endsWith",
          candidate: raw,
          entry,
          candidates,
          normalizedEntries,
        };
      }
      if (entry.sanitized && sanitized.endsWith(entry.sanitized)) {
        return {
          matched: true,
          reason: "sanitizedEndsWith",
          candidate: raw,
          entry,
          candidates,
          normalizedEntries,
        };
      }
      if (
        entry.length >= 3 &&
        (lower.includes(entry.exact) ||
          (entry.sanitized && sanitized.includes(entry.sanitized)))
      ) {
        return {
          matched: true,
          reason: "includes",
          candidate: raw,
          entry,
          candidates,
          normalizedEntries,
        };
      }
    }
  }

  return {
    matched: false,
    reason: "notMatched",
    candidates,
    normalizedEntries,
  };
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

  const timeoutMs = 500;
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
      switch (platform.variableType) {
        case "ANY":
          return resolvedUrl.replace("{ANY}", encodeURIComponent(address));
          break;
        default:
          return resolvedUrl.replace("{CA}", encodeURIComponent(address));
          break;
      }
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
  const excludeActiveApp = config.excludeActiveApp !== false;
  const includedApps = Array.isArray(config.includedApps)
    ? config.includedApps
    : [];
  const includeActiveAppOnly = config.includeActiveAppOnly === true;

  const shouldCheckInclude =
    includeActiveAppOnly && includedApps.length > 0;
  const shouldCheckExclude =
    excludeActiveApp && excludedApps.length > 0;

  let activeApp: ActiveApplicationInfo | null = null;
  if (shouldCheckInclude || shouldCheckExclude) {
    try {
      activeApp = await getActiveApplication();
      console.log("[rushmeme] active application info", { activeApp });
    } catch (error) {
      console.warn(
        "[rushmeme] failed to resolve active application:",
        error,
      );
    }
  }

  if (shouldCheckInclude) {
    console.log("[rushmeme] evaluating allowed applications", {
      includedApps,
      includeActiveAppOnly,
      platform: process.platform,
    });
    const match = matchApplication(activeApp, includedApps);
    if (match.matched) {
      console.log("[rushmeme] allowlist matched", {
        candidate: match.candidate,
        reason: match.reason,
        entry: {
          exact: match.entry.exact,
          sanitized: match.entry.sanitized,
        },
      });
    } else {
      switch (match.reason) {
        case "noEntries":
          console.log(
            "[rushmeme] allowlist check skipped: no normalized entries",
            { includedApps },
          );
          break;
        case "noInfo":
          console.log(
            "[rushmeme] allowlist check skipped: active application unavailable",
          );
          break;
        case "noCandidates":
          console.log(
            "[rushmeme] allowlist check skipped: no application candidates",
            { appInfo: activeApp },
          );
          break;
        case "notMatched":
          console.log("[rushmeme] allowlist not matched", {
            candidates: match.candidates,
            normalizedIncluded: match.normalizedEntries.map((entry) => ({
              exact: entry.exact,
              sanitized: entry.sanitized,
            })),
          });
          break;
      }

      if (match.reason !== "noEntries") {
        return {
          success: false,
          opened,
          error:
            "Execution skipped because the active application is not on the allowlist.",
          selectionCaptured: false,
          skippedBecauseExcluded: true,
        };
      }
    }
  } else if (includeActiveAppOnly) {
    console.log(
      "[rushmeme] allowlist enabled but no applications configured; check skipped",
    );
  }

  if (shouldCheckExclude) {
    console.log("[rushmeme] evaluating excluded applications", {
      excludedApps,
      excludeActiveApp,
      platform: process.platform,
    });
    const match = matchApplication(activeApp, excludedApps);
    if (match.matched) {
      console.log(
        "[rushmeme] execution skipped: active application is excluded.",
        {
          candidate: match.candidate,
          reason: match.reason,
          entry: {
            exact: match.entry.exact,
            sanitized: match.entry.sanitized,
          },
        },
      );
      return {
        success: false,
        opened,
        error:
          "Execution skipped because the active application is excluded.",
        selectionCaptured: false,
        skippedBecauseExcluded: true,
      };
    }

    switch (match.reason) {
      case "noEntries":
        console.log(
          "[rushmeme] exclusion check aborted: no normalized entries",
          { excluded: excludedApps },
        );
        break;
      case "noInfo":
        console.log(
          "[rushmeme] exclusion check aborted: active application unavailable",
        );
        break;
      case "noCandidates":
        console.log("[rushmeme] exclusion check aborted: no candidates", {
          appInfo: activeApp,
        });
        break;
      case "notMatched":
        console.log("[rushmeme] exclusion not matched", {
          candidates: match.candidates,
          normalizedExcluded: match.normalizedEntries.map((entry) => ({
            exact: entry.exact,
            sanitized: entry.sanitized,
          })),
        });
        break;
    }
  }

  if (!excludeActiveApp && !includeActiveAppOnly) {
    console.log("[rushmeme] excluded applications disabled");
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
  const getVariableType = (platform: PlatformConfig) =>
    platform.variableType ?? "CA";
  const anyPlatforms = enabledPlatforms.filter(
    (platform) => getVariableType(platform) === "ANY",
  );
  const standardPlatforms = enabledPlatforms.filter(
    (platform) => getVariableType(platform) !== "ANY",
  );

  const detectedAddresses =
    standardPlatforms.length > 0 ? extractAddressesFromText(rawInput) : [];

  if (
    standardPlatforms.length > 0 &&
    detectedAddresses.length === 0 &&
    anyPlatforms.length === 0
  ) {
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

  type PendingUrl = { url: string; platform: PlatformConfig; address: string };
  const urlsToOpen: PendingUrl[] = [];

  if (detectedAddresses.length > 0) {
    standardPlatforms.forEach((platform) => {
      detectedAddresses.forEach(({ address, type }) => {
        buildPlatformUrls(platform, address, type).forEach((url) => {
          urlsToOpen.push({ url, platform, address });
        });
      });
    });
  }

  if (anyPlatforms.length > 0 && rawInput) {
    anyPlatforms.forEach((platform) => {
      buildPlatformUrls(platform, rawInput, "unknown").forEach((url) => {
        urlsToOpen.push({ url, platform, address: rawInput });
      });
    });
  }

  if (urlsToOpen.length === 0) {
    if (config.notifications.enabled) {
      showNotification({
        title: "RushMeme",
        body: "No enabled platforms were available for the captured address.",
        variant: "error",
      });
    }
    restoreClipboardIfNeeded();
    const firstAddress =
      detectedAddresses[0]?.address ?? (anyPlatforms.length > 0 ? rawInput : undefined);
    return {
      success: false,
      opened,
      address: firstAddress,
      error: "No enabled platforms available to open.",
      selectionCaptured,
    };
  }

  console.log(
    "[rushmeme] urls to open",
    urlsToOpen.map((entry) => ({
      platform: entry.platform.name,
      url: entry.url,
    })),
  );

  if (config.notifications.enabled) {
    const addressSummary =
      detectedAddresses.length > 0
        ? detectedAddresses.length === 1
          ? detectedAddresses[0].address
          : `${detectedAddresses.length} addresses`
        : rawInput;
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
    address:
      detectedAddresses[0]?.address ?? (anyPlatforms.length > 0 ? rawInput : undefined),
    selectionCaptured,
  };
}
