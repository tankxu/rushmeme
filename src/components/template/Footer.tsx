import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openExternalLink } from "@/helpers/shell";
import type { AppLatestRelease, AppRuntimeInfo } from "@/types/app";

const VERSION_CHECK_DELAY_MS = 5_000;
const VERSION_CHECK_COOLDOWN_MS = 60_000;
const VERSION_CHECK_AFTER_REPORT_MS = 3_000;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type ParsedIdentifier =
  | { type: "number"; value: number }
  | { type: "string"; value: string };

function parseSemver(version: string) {
  const sanitized = version.trim();
  const coreSegment = sanitized.split("+")[0] ?? sanitized;
  const [corePart = "", prereleasePart = ""] = coreSegment.split("-");
  const coreTokens = corePart.split(".");
  const [major = "0", minor = "0", patch = "0"] = coreTokens;
  const parseNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const prereleaseTokens = prereleasePart
    ? prereleasePart
        .split(".")
        .map((token) => token.trim())
        .filter(Boolean)
    : [];

  const parseIdentifier = (token: string): ParsedIdentifier => {
    if (/^\d+$/.test(token)) {
      return { type: "number", value: Number(token) };
    }
    return { type: "string", value: token.toLowerCase() };
  };

  const prereleaseIdentifiers = prereleaseTokens.map(parseIdentifier);

  return {
    major: parseNumber(major),
    minor: parseNumber(minor),
    patch: parseNumber(patch),
    prerelease: prereleaseIdentifiers,
  };
}

function compareIdentifiers(a: ParsedIdentifier, b: ParsedIdentifier): number {
  if (a.type === b.type) {
    if (a.value < b.value) {
      return -1;
    }
    if (a.value > b.value) {
      return 1;
    }
    return 0;
  }
  if (a.type === "number") {
    return -1;
  }
  return 1;
}

function compareSemver(a: string, b: string): number {
  try {
    const left = parseSemver(a);
    const right = parseSemver(b);

    if (left.major !== right.major) {
      return left.major - right.major;
    }
    if (left.minor !== right.minor) {
      return left.minor - right.minor;
    }
    if (left.patch !== right.patch) {
      return left.patch - right.patch;
    }

    const leftHasPrerelease = left.prerelease.length > 0;
    const rightHasPrerelease = right.prerelease.length > 0;

    if (!leftHasPrerelease && !rightHasPrerelease) {
      return 0;
    }
    if (!leftHasPrerelease) {
      return 1;
    }
    if (!rightHasPrerelease) {
      return -1;
    }

    const maxLength = Math.max(left.prerelease.length, right.prerelease.length);
    for (let index = 0; index < maxLength; index += 1) {
      const leftId = left.prerelease[index];
      const rightId = right.prerelease[index];
      if (!leftId) {
        return -1;
      }
      if (!rightId) {
        return 1;
      }
      const comparison = compareIdentifiers(leftId, rightId);
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  } catch (error) {
    console.warn("[rushmeme] semver comparison failed", { error, a, b });
    return a.localeCompare(b);
  }
}

function formatPlatformLabel(key: string, translate: TranslateFn): string {
  const normalized = key.trim().toLowerCase();
  switch (normalized) {
    case "mac":
    case "macos":
      return translate("footer.platform.macosGeneric");
    case "mac_arm":
    case "mac-arm":
    case "macos_arm":
    case "macos-arm":
    case "mac_arm64":
      return translate("footer.platform.macosAppleSilicon");
    case "mac_intel":
    case "mac-intel":
    case "macos_intel":
    case "macos-intel":
      return translate("footer.platform.macosIntel");
    case "windows":
    case "win":
      return translate("footer.platform.windows");
    case "linux":
      return translate("footer.platform.linux");
    case "android":
      return translate("footer.platform.android");
    case "ios":
      return translate("footer.platform.ios");
    default:
      return translate(`footer.platform.${normalized}`, {
        defaultValue: key.toUpperCase(),
      });
  }
}

function sanitizeNotes(value: unknown, language: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const firstChar = trimmed[0];
    const lastChar = trimmed[trimmed.length - 1];
    const looksLikeJsonObject = firstChar === "{" && lastChar === "}";
    const looksLikeJsonArray = firstChar === "[" && lastChar === "]";
    if (looksLikeJsonObject || looksLikeJsonArray) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          return sanitizeNotes(parsed, language);
        }
      } catch {
        // ignore parse failure and fall back to raw string
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "")).join("\n");
  }
  if (value && typeof value === "object") {
    const notes = value as Record<string, unknown>;
    const candidates: string[] = [];
    const normalizedLang = language.toLowerCase();
    const [primaryLang = normalizedLang, regionLang = ""] =
      normalizedLang.split("-");
    candidates.push(
      normalizedLang,
      language,
      primaryLang,
      primaryLang.toLowerCase(),
      ...(regionLang ? [regionLang, regionLang.toLowerCase()] : []),
      // Short-hand mapping for common aliases (e.g., zh-cn -> cn)
      ...(primaryLang === "zh" || normalizedLang.startsWith("zh")
        ? ["cn"]
        : []),
      "en",
      "default",
    );

    for (const key of candidates) {
      const entry = notes[key];
      if (typeof entry === "string" && entry.trim()) {
        return entry.trim();
      }
    }

    const firstString = Object.values(notes).find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
    if (typeof firstString === "string") {
      return firstString.trim();
    }
    return JSON.stringify(notes, null, 2);
  }
  return "";
}

function buildDownloadKeyPriority(info: AppRuntimeInfo | null): string[] {
  const keys: string[] = [];
  if (!info) {
    return keys;
  }

  const { platform, arch } = info;
  if (platform === "darwin") {
    if (arch === "arm64") {
      keys.push(
        "mac-arm",
        "mac_arm",
        "macos-arm",
        "macos_arm",
        "mac-arm64",
        "macos-arm64",
      );
    } else if (arch === "x64" || arch === "ia32") {
      keys.push(
        "mac-intel",
        "mac_intel",
        "macos-intel",
        "macos_intel",
        "mac-x64",
        "macos-x64",
      );
    }
    keys.push("mac", "macos", "darwin");
  } else if (platform === "win32") {
    if (arch === "arm64") {
      keys.push("win-arm64", "windows-arm64", "win-arm", "windows-arm");
    } else if (arch === "ia32") {
      keys.push("win-ia32", "windows-ia32", "win32");
    } else {
      keys.push("win-x64", "windows-x64", "win64");
    }
    keys.push("win", "windows");
  } else if (platform === "linux") {
    if (arch === "arm64") {
      keys.push("linux-arm64", "linux-arm");
    } else if (arch === "arm") {
      keys.push("linux-arm");
    } else if (arch === "x64") {
      keys.push("linux-x64", "linux64");
    }
    keys.push("linux");
  }

  return Array.from(new Set(keys));
}

function resolveDownloadUrl(
  release: AppLatestRelease | null,
  runtimeInfo: AppRuntimeInfo | null,
): { url: string; key: string } | null {
  if (!release?.download_urls) {
    return null;
  }
  const entries = Object.entries(release.download_urls).filter(
    ([, url]) => typeof url === "string" && url.trim().length > 0,
  );
  if (entries.length === 0) {
    return null;
  }

  const priority = buildDownloadKeyPriority(runtimeInfo);
  for (const key of priority) {
    const match = entries.find(
      ([entryKey]) => entryKey.toLowerCase() === key.toLowerCase(),
    );
    if (match) {
      return { key: match[0], url: match[1].trim() };
    }
  }

  const fallback = entries[0];
  return { key: fallback[0], url: fallback[1].trim() };
}

export default function Footer() {
  const { t, i18n } = useTranslation();
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(
    null,
  );
  const [latestRelease, setLatestRelease] =
    React.useState<AppLatestRelease | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [runtimeInfo, setRuntimeInfo] = React.useState<AppRuntimeInfo | null>(
    null,
  );
  const lastCheckRef = React.useRef<number>(0);
  const scheduledCheckRef = React.useRef<number | null>(null);
  const lastValidationRef = React.useRef<string | null>(null);

  const handleOpenLink = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
      event.preventDefault();
      openExternalLink(url);
    },
    [],
  );

  const clearScheduledCheck = React.useCallback(() => {
    if (scheduledCheckRef.current) {
      window.clearTimeout(scheduledCheckRef.current);
      scheduledCheckRef.current = null;
    }
  }, []);

  const runVersionCheck = React.useCallback(async () => {
    if (!window.rushApp?.fetchLatestRelease) {
      return;
    }
    if (!currentVersion) {
      return;
    }

    const now = Date.now();
    if (now - lastCheckRef.current < VERSION_CHECK_COOLDOWN_MS) {
      return;
    }

    lastCheckRef.current = now;

    try {
      const response = await window.rushApp.fetchLatestRelease();
      if (!response?.ok) {
        if (response && !response.ok) {
          console.warn("[rushmeme] latest version fetch failed", response);
        }
        return;
      }

      const release = response.data;
      if (!release?.version) {
        return;
      }

      if (compareSemver(release.version, currentVersion) > 0) {
        setLatestRelease(release);
        if (release.force_update) {
          setDialogOpen(true);
        }
      } else {
        setLatestRelease(null);
      }
    } catch (error) {
      console.warn("[rushmeme] latest version check failed", error);
    }
  }, [currentVersion]);

  const scheduleVersionCheck = React.useCallback(
    (delayMs: number) => {
      if (!currentVersion) {
        return;
      }
      if (delayMs < 0) {
        delayMs = 0;
      }
      clearScheduledCheck();
      scheduledCheckRef.current = window.setTimeout(() => {
        scheduledCheckRef.current = null;
        void runVersionCheck();
      }, delayMs);
    },
    [clearScheduledCheck, currentVersion, runVersionCheck],
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!window.rushApp?.getVersion) {
      return () => {
        cancelled = true;
      };
    }

    window.rushApp
      .getVersion()
      .then((version) => {
        if (!cancelled) {
          setCurrentVersion(version);
        }
      })
      .catch((error) => {
        console.warn("[rushmeme] failed to resolve current version", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!window.rushApp?.getRuntimeInfo) {
      return () => {
        cancelled = true;
      };
    }

    window.rushApp
      .getRuntimeInfo()
      .then((info) => {
        if (!cancelled) {
          setRuntimeInfo(info);
        }
      })
      .catch((error) => {
        console.warn("[rushmeme] failed to resolve runtime info", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!currentVersion) {
      return undefined;
    }
    scheduleVersionCheck(VERSION_CHECK_DELAY_MS);
    return () => {
      clearScheduledCheck();
    };
  }, [clearScheduledCheck, currentVersion, scheduleVersionCheck]);

  React.useEffect(() => {
    if (!window.rushLicense?.watch) {
      return undefined;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    window.rushLicense
      .watch((snapshot) => {
        if (disposed) {
          return;
        }
        const nextValidatedAt = snapshot?.lastValidatedAt ?? null;
        if (nextValidatedAt && nextValidatedAt !== lastValidationRef.current) {
          lastValidationRef.current = nextValidatedAt;
          scheduleVersionCheck(VERSION_CHECK_AFTER_REPORT_MS);
        }
      })
      .then((stop) => {
        if (disposed) {
          stop();
          return;
        }
        unsubscribe = stop;
      })
      .catch((error) => {
        console.warn(
          "[rushmeme] failed to subscribe to license updates",
          error,
        );
      });

    return () => {
      disposed = true;
      clearScheduledCheck();
      unsubscribe?.();
    };
  }, [clearScheduledCheck, scheduleVersionCheck]);

  const isUpdateAvailable = React.useMemo(() => {
    if (!currentVersion || !latestRelease?.version) {
      return false;
    }
    return compareSemver(latestRelease.version, currentVersion) > 0;
  }, [currentVersion, latestRelease]);

  const releaseNotes = React.useMemo(() => {
    if (!latestRelease?.notes || !isUpdateAvailable) {
      return "";
    }
    const language = i18n.language ?? "en";
    return sanitizeNotes(latestRelease.notes, language);
  }, [i18n.language, isUpdateAvailable, latestRelease]);

  const downloadTarget = React.useMemo(() => {
    if (!isUpdateAvailable) {
      return null;
    }
    return resolveDownloadUrl(latestRelease, runtimeInfo);
  }, [isUpdateAvailable, latestRelease, runtimeInfo]);

  const downloadUrl = downloadTarget?.url ?? null;
  const downloadPlatformLabel = React.useMemo(() => {
    if (!downloadTarget) {
      return null;
    }
    return formatPlatformLabel(downloadTarget.key, t);
  }, [downloadTarget, t]);

  React.useEffect(() => {
    if (!isUpdateAvailable) {
      setDialogOpen(false);
    }
  }, [isUpdateAvailable]);

  const handleOpenDownload = React.useCallback((url: string) => {
    openExternalLink(url);
  }, []);

  return (
    <>
      <Dialog
        open={dialogOpen && isUpdateAvailable}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("footer.versionDialogTitle")}</DialogTitle>
            <DialogDescription>
              {latestRelease?.version
                ? t("footer.versionDialogDescription", {
                    version: latestRelease.version,
                  })
                : t("footer.versionDialogGeneric")}
            </DialogDescription>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4 text-sm">
            {releaseNotes ? (
              <div>
                <p className="text-foreground font-medium">
                  {t("footer.versionDialogNotesTitle")}
                </p>
                <div className="border-border/60 bg-muted/50 text-foreground mt-2 max-h-60 overflow-y-auto rounded-md border p-3 whitespace-pre-wrap">
                  {releaseNotes}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="sm:flex-row sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("footer.closeButtonLabel")}
            </Button>
            <Button
              type="button"
              onClick={() => downloadUrl && handleOpenDownload(downloadUrl)}
              disabled={!downloadUrl}
            >
              {t("footer.downloadButtonLabel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <footer className="font-tomorrow text-muted-foreground flex flex-wrap items-center justify-between gap-3 px-1 text-[0.7rem] uppercase">
        <p>
          <span>
            <a
              href="https://rushmeme.vip"
              onClick={(event) => handleOpenLink(event, "https://rushmeme.vip")}
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              RUSHMEME.VIP
            </a>
          </span>
          <span className="mx-2">|</span>
          <span>
            Made by
            <a
              href="https://x.com/tankxu"
              onClick={(event) => handleOpenLink(event, "https://x.com/tankxu")}
              rel="noreferrer"
              className="ml-1 underline-offset-2 hover:underline"
            >
              0xTank
            </a>
          </span>
        </p>
        <div className="flex items-center gap-2">
          <span className="tracking-normal">
            {currentVersion ? "Version: " + currentVersion : "Version: unknown"}
          </span>
          {isUpdateAvailable ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="focus:outline-none"
            >
              <Badge className="bg-cyan-600 font-sans font-normal text-white hover:bg-cyan-500">
                {t("footer.newVersionBadge")}
              </Badge>
            </button>
          ) : null}
        </div>
      </footer>
    </>
  );
}
