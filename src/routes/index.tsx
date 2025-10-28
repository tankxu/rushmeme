import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ToggleTheme from "@/components/ToggleTheme";
import LangToggle from "@/components/LangToggle";
import Footer from "@/components/template/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Settings2,
} from "lucide-react";
import { isMacOS } from "@/utils/platform";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import type { PlatformConfig, PlatformTemplate } from "@/types/config";
import {
  PLATFORM_TEMPLATES,
  DEFAULT_BROWSER_DELAY,
} from "@/config/platform-templates";
import { createDefaultAppConfig } from "@/config/default-config";
import {
  extractChainSpecFromUrl,
  normalizeChainTokenKey,
  normalizeUrlTemplates,
  parseChainSpec,
} from "@/utils/chain";

type SaveStatus = "saved" | "saving" | "failed";

type ShortcutLabels = {
  meta: string;
  ctrl: string;
  alt: string;
  shift: string;
};

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt"]);

function formatShortcutFromEvent(
  event: React.KeyboardEvent<HTMLInputElement>,
  labels: ShortcutLabels,
) {
  const modifiers: string[] = [];

  if (event.metaKey) {
    modifiers.push(labels.meta);
  }
  if (event.ctrlKey) {
    modifiers.push(labels.ctrl);
  }
  if (event.altKey) {
    modifiers.push(labels.alt);
  }
  if (event.shiftKey) {
    modifiers.push(labels.shift);
  }

  let key = event.key;
  if (key === " ") {
    key = "Space";
  }

  const isModifierKey = MODIFIER_KEYS.has(key);
  if (isModifierKey) {
    return "";
  }

  if (key.length === 1) {
    key = key.toUpperCase();
  }

  const parts = [...modifiers, key];
  if (key.length === 0) {
    return "";
  }

  return labels.meta === "⌘" ? parts.join("") : parts.join(" + ");
}

const CHAIN_LABEL_OVERRIDES: Record<string, string> = {
  any: "Any",
  base: "Base",
  bsc: "BSC",
  bnbchain: "BNB Chain",
  eth: "ETH",
  evm: "EVM",
  sol: "Solana",
  solana: "Solana",
  "x-layer": "X Layer",
  "x layer": "X Layer",
  xlayer: "X Layer",
};

const SOLANA_CHAIN_KEYS = new Set(
  ["sol", "solana"].map(normalizeChainTokenKey),
);
const SOLANA_COMPATIBLE_EVM_KEYS = new Set(
  ["bsc", "bnbchain", "base", "evm", "eth", "ethereum", "xlayer"].map(
    normalizeChainTokenKey,
  ),
);
const EVM_COMBO_CANONICAL_SPEC: Record<string, string> = {
  ethereum: "eth",
  bnbchain: "bsc",
};

function sortChainTokens(tokens: string[]): string[] {
  const priority = (token: string) => {
    const key = normalizeChainTokenKey(token);
    if (key === "any") {
      return -1;
    }
    if (SOLANA_COMPATIBLE_EVM_KEYS.has(key)) {
      return 0;
    }
    if (SOLANA_CHAIN_KEYS.has(key)) {
      return 1;
    }
    return 2;
  };

  return [...tokens].sort((a, b) => {
    const priorityDiff = priority(a) - priority(b);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return normalizeChainTokenKey(a).localeCompare(normalizeChainTokenKey(b));
  });
}

function formatChainTokenDisplay(token: string): string {
  if (!token) {
    return "Any";
  }

  const normalized = token.toLowerCase();
  const override = CHAIN_LABEL_OVERRIDES[normalized];
  if (override) {
    return override;
  }

  if (normalized.length <= 3) {
    return normalized.toUpperCase();
  }

  return normalized
    .split("-")
    .map((segment) =>
      segment.length <= 3
        ? segment.toUpperCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");
}

function getChainDisplayLabel(
  chain: string | undefined,
  fallback: string,
): string {
  const tokens = parseChainSpec(chain ?? "");
  const fallbackTokens =
    tokens.length > 0 ? tokens : parseChainSpec(fallback ?? "");
  const effectiveTokens = fallbackTokens.length > 0 ? fallbackTokens : ["any"];

  return effectiveTokens.map(formatChainTokenDisplay).join(" / ");
}

function instantiatePlatformInstance(
  template: PlatformTemplate,
  index: number,
): PlatformConfig {
  const normalizedUrls = normalizeUrlTemplates(
    template.urls,
    template.tokenType,
  );
  return {
    id: index === 0 ? template.key : `${template.key}-${index}`,
    key: template.key,
    name: template.name,
    tokenType: template.tokenType,
    shortcut: template.shortcut,
    enabled: template.enabled,
    requiresPro: template.requiresPro,
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(
        entry.url,
        entry.chain ?? template.tokenType,
      ),
    })),
    accelerator: convertDisplayShortcutToAccelerator(template.shortcut),
  };
}

function canonicalizeTokenType(spec?: string): string | null {
  if (!spec) {
    return null;
  }

  const tokens = parseChainSpec(spec);
  if (tokens.length === 0) {
    const trimmed = spec.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const seen = new Set<string>();
  const uniqueTokens: string[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeChainTokenKey(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueTokens.push(trimmed);
  }
  const sorted = sortChainTokens(uniqueTokens);
  return sorted.map(formatChainTokenDisplay).join(" | ");
}

function buildTokenOptions(platform: PlatformConfig): string[] {
  const template = PLATFORM_TEMPLATES.find((item) => item.key === platform.key);
  const options = new Map<string, string>();
  const solanaCandidates = new Set<string>();
  const evmCandidates = new Set<string>();

  const buildKey = (spec: string) => {
    const parsed = parseChainSpec(spec).map((token) =>
      normalizeChainTokenKey(token),
    );
    const key =
      parsed.length > 0 ? parsed.join("|") : normalizeChainTokenKey(spec);
    return key || spec.trim().toLowerCase();
  };

  const collectTokens = (spec?: string) => {
    const tokens = parseChainSpec(spec ?? "");
    for (const token of tokens) {
      const tokenKey = normalizeChainTokenKey(token);
      if (SOLANA_CHAIN_KEYS.has(tokenKey)) {
        solanaCandidates.add("solana");
      }
      if (SOLANA_COMPATIBLE_EVM_KEYS.has(tokenKey)) {
        evmCandidates.add(tokenKey);
      }
    }
  };

  const register = (spec?: string) => {
    collectTokens(spec);
    const canonical = canonicalizeTokenType(spec ?? "");
    if (!canonical) {
      return;
    }

    const key = buildKey(canonical);
    if (!options.has(key)) {
      options.set(key, canonical);
    }
  };

  for (const entry of platform.urls) {
    register(entry.chain);
  }

  if (template) {
    for (const entry of template.urls) {
      register(entry.chain);
    }
  }

  if (solanaCandidates.size > 0 && evmCandidates.size > 0) {
    const solanaToken = "solana";
    for (const evmToken of Array.from(evmCandidates)) {
      const canonicalSpec = EVM_COMBO_CANONICAL_SPEC[evmToken] ?? evmToken;
      register(`${canonicalSpec}|${solanaToken}`);
    }
  }

  const currentCanonical = canonicalizeTokenType(platform.tokenType);
  if (currentCanonical) {
    const key = buildKey(currentCanonical);
    if (!options.has(key)) {
      options.set(key, currentCanonical);
    }
  }

  const values = Array.from(options.values());
  if (values.length > 0) {
    return values;
  }

  return [currentCanonical ?? "Any"];
}

function clonePlatformForCustom(
  name: string,
  tokenType = "Any",
  shortcutDisplay = "⌘⇧C",
  initiallyEnabled = true,
): PlatformConfig {
  const defaultUrl = "https://your-platform.com/token/{CA}";
  const urls = normalizeUrlTemplates(
    [
      {
        chain: extractChainSpecFromUrl(defaultUrl, tokenType),
        url: defaultUrl,
      },
    ],
    tokenType,
  ).map((entry) => ({
    ...entry,
    chain: extractChainSpecFromUrl(entry.url, entry.chain ?? tokenType),
  }));

  const canonicalTokenType = canonicalizeTokenType(tokenType) ?? tokenType;

  return {
    id: `custom-${Date.now()}`,
    key: "custom",
    name,
    tokenType: canonicalTokenType,
    shortcut: shortcutDisplay,
    enabled: initiallyEnabled,
    urls,
    accelerator: convertDisplayShortcutToAccelerator(shortcutDisplay),
  };
}

function withAccelerator(platform: PlatformConfig): PlatformConfig {
  const accelerator = convertDisplayShortcutToAccelerator(platform.shortcut);
  return {
    ...platform,
    accelerator: accelerator ?? platform.accelerator,
  };
}

function normalizePlatformForState(platform: PlatformConfig): PlatformConfig {
  const normalizedUrls = normalizeUrlTemplates(
    platform.urls,
    platform.tokenType,
  );
  return withAccelerator({
    ...platform,
    tokenType: canonicalizeTokenType(platform.tokenType) ?? platform.tokenType,
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(entry.url, entry.chain),
    })),
  });
}

function clonePlatformConfig(platform: PlatformConfig): PlatformConfig {
  return {
    ...platform,
    tokenType: canonicalizeTokenType(platform.tokenType) ?? platform.tokenType,
    urls: platform.urls.map((entry) => ({ ...entry })),
  };
}

function adjustPlatformForTokenType(
  platform: PlatformConfig,
  tokenType: string,
): PlatformConfig {
  const canonicalTarget = canonicalizeTokenType(tokenType) ?? tokenType;
  const targetTokens = parseChainSpec(tokenType).map((token) =>
    normalizeChainTokenKey(token),
  );
  const canonical = (spec: string) =>
    (() => {
      const tokens = parseChainSpec(spec)
        .map((token) => normalizeChainTokenKey(token))
        .filter(Boolean)
        .sort();
      return tokens.length > 0 ? tokens.join("|") : "any";
    })();
  const template = PLATFORM_TEMPLATES.find((item) => item.key === platform.key);

  const normalizeSource = (source: PlatformConfig["urls"]) =>
    normalizeUrlTemplates(
      source.map((entry) => ({
        ...entry,
        chain: extractChainSpecFromUrl(entry.url, entry.chain),
      })),
      tokenType,
    ).map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(entry.url, entry.chain ?? tokenType),
    }));

  const normalizedCurrent = normalizeSource(platform.urls);
  const currentByChain = new Map(
    normalizedCurrent.map((entry) => [canonical(entry.chain), entry]),
  );

  let nextUrls: typeof normalizedCurrent;

  if (template) {
    const templateNormalized = normalizeSource(template.urls);
    nextUrls = templateNormalized.map((entry) => {
      const existing = currentByChain.get(canonical(entry.chain));
      if (existing) {
        return {
          ...existing,
          chain: entry.chain,
        };
      }
      return entry;
    });

    const templateChains = new Set(
      templateNormalized.map((entry) => canonical(entry.chain)),
    );
    const extras = normalizedCurrent.filter(
      (entry) => !templateChains.has(canonical(entry.chain)),
    );
    nextUrls = [...nextUrls, ...extras];
  } else {
    nextUrls = normalizedCurrent;
  }

  if (targetTokens.length > 0 && !targetTokens.includes("any")) {
    const allowed = new Set(targetTokens);
    nextUrls = nextUrls.filter((entry) => {
      const entryTokens = parseChainSpec(entry.chain).map((token) =>
        normalizeChainTokenKey(token),
      );
      if (entryTokens.length === 0) {
        return true;
      }
      return entryTokens.some((token) => allowed.has(token));
    });
  }

  if (nextUrls.length === 0) {
    const fallbackSource = template?.urls?.[0] ??
      platform.urls?.[0] ?? {
        chain: tokenType,
        url: "https://example.com/{CA}",
      };
    nextUrls = normalizeSource([
      {
        ...fallbackSource,
        chain: extractChainSpecFromUrl(
          fallbackSource.url,
          fallbackSource.chain ?? tokenType,
        ),
      },
    ]);
  }

  return {
    ...platform,
    tokenType: canonicalTarget,
    urls: nextUrls,
  };
}

function HomePage() {
  const { t } = useTranslation();
  const defaultsRef = React.useRef(createDefaultAppConfig());
  const licenseRef = React.useRef(defaultsRef.current.license);
  const [platforms, setPlatforms] = React.useState<PlatformConfig[]>(
    defaultsRef.current.platforms.map(normalizePlatformForState),
  );
  const [browserDelay, setBrowserDelay] = React.useState<number>(
    defaultsRef.current.browserDelayMs,
  );
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    defaultsRef.current.notifications.enabled,
  );
  const [isPro, setIsPro] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [statusVisible, setStatusVisible] = React.useState(false);
  const hydrationRef = React.useRef(true);
  const hasStatusMounted = React.useRef(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = React.useState(false);
  const [editingPlatformId, setEditingPlatformId] = React.useState<
    string | null
  >(null);
  const [editingPlatformDraft, setEditingPlatformDraft] =
    React.useState<PlatformConfig | null>(null);
  const [editingMode, setEditingMode] = React.useState<
    "create" | "edit" | null
  >(null);
  const isMac = React.useMemo(() => isMacOS(), []);
  const shortcutLabels = React.useMemo(
    () => ({
      meta: isMac ? "⌘" : "Win",
      ctrl: isMac ? "⌃" : "Ctrl",
      alt: isMac ? "⌥" : "Alt",
      shift: isMac ? "⇧" : "Shift",
    }),
    [isMac],
  );

  const configApi =
    typeof window !== "undefined" ? window.rushConfig : undefined;
  const licenseApi =
    typeof window !== "undefined" ? window.rushLicense : undefined;
  const defaultCustomShortcut = isMac ? "⌘⇧C" : "Ctrl + Shift + C";

  React.useEffect(() => {
    return () => {
      configApi?.resumeShortcuts?.();
    };
  }, [configApi]);

  React.useEffect(() => {
    if (isPro) {
      setUpgradeDialogOpen(false);
    }
  }, [isPro]);

  React.useEffect(() => {
    if (!licenseApi?.watch) {
      return;
    }

    let disposed = false;
    let stop: (() => void) | undefined;

    licenseApi
      .watch((snapshot) => {
        licenseRef.current = snapshot;
        setIsPro(snapshot.status === "active");
      })
      .then((unsubscribe) => {
        if (disposed) {
          unsubscribe();
          return;
        }
        stop = unsubscribe;
      })
      .catch((error) => {
        console.error("Failed to subscribe to license updates", error);
      });

    return () => {
      disposed = true;
      if (stop) {
        stop();
      }
    };
  }, [licenseApi]);

  React.useEffect(() => {
    if (editingMode !== "edit" || !editingPlatformId) {
      return;
    }

    setEditingPlatformDraft((previous) => {
      if (previous && previous.id === editingPlatformId) {
        return previous;
      }
      const source = platforms.find((item) => item.id === editingPlatformId);
      if (!source) {
        return null;
      }
      return clonePlatformConfig(source);
    });
  }, [editingMode, editingPlatformId, platforms]);

  React.useEffect(() => {
    let cancelled = false;

    if (!configApi) {
      hydrationRef.current = false;
      setLoading(false);
      return;
    }

    async function loadConfig() {
      try {
        const config = await configApi?.getConfig();
        if (cancelled || !config) {
          return;
        }
        hydrationRef.current = true;
        setIsPro(Boolean(config.isPro));
        setPlatforms(config.platforms.map(normalizePlatformForState));
        setBrowserDelay(config.browserDelayMs ?? DEFAULT_BROWSER_DELAY);
        // preserve license for saving
        licenseRef.current = config.license;
        setNotificationsEnabled(
          Boolean(
            config.notifications?.enabled ??
              defaultsRef.current.notifications.enabled,
          ),
        );
        await Promise.resolve();
      } catch (error) {
        console.error("Failed to load RushMeme config", error);
      } finally {
        if (!cancelled) {
          hydrationRef.current = false;
          setLoading(false);
        }
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [configApi]);

  React.useEffect(() => {
    if (loading || hydrationRef.current || !configApi) {
      return;
    }

    let cancelled = false;
    setStatus("saving");

    const payload = {
      platforms,
      notifications: {
        enabled: notificationsEnabled,
      },
      browserDelayMs: browserDelay,
      license: licenseRef.current,
    };

    configApi
      .saveConfig(payload)
      .then(() => {
        if (!cancelled) {
          setStatus("saved");
        }
      })
      .catch((error) => {
        console.error("Failed to save RushMeme config", error);
        if (!cancelled) {
          setStatus("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [browserDelay, configApi, loading, notificationsEnabled, platforms]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    if (!hasStatusMounted.current) {
      hasStatusMounted.current = true;
      return;
    }

    if (status === "saving") {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setStatusVisible(true);
      const timer = setTimeout(() => setStatus("saved"), 400);
      return () => clearTimeout(timer);
    }

    if (status === "saved") {
      setStatusVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      hideTimerRef.current = setTimeout(() => {
        setStatusVisible(false);
        hideTimerRef.current = null;
      }, 2000);

      return () => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      };
    }

    if (status === "failed") {
      setStatusVisible(true);
    }

    return undefined;
  }, [loading, status]);

  const handleTogglePlatform = React.useCallback(
    (id: string, checked: boolean) => {
      setPlatforms((previous) => {
        const target = previous.find((platform) => platform.id === id);
        if (!target) {
          return previous;
        }

        if (
          !isPro &&
          checked &&
          !target.enabled &&
          previous.some((platform) => platform.id !== id && platform.enabled)
        ) {
          setUpgradeDialogOpen(true);
          return previous;
        }

        return previous.map((platform) =>
          platform.id === id ? { ...platform, enabled: checked } : platform,
        );
      });
    },
    [isPro, setUpgradeDialogOpen],
  );

  const handleTokenTypeChange = React.useCallback(
    (id: string, value: string) => {
      const canonicalValue = canonicalizeTokenType(value) ?? value;

      if (editingPlatformId === id) {
        setEditingPlatformDraft((previous) =>
          previous
            ? adjustPlatformForTokenType(previous, canonicalValue)
            : previous,
        );
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) => {
          if (platform.id !== id) {
            return platform;
          }

          return adjustPlatformForTokenType(platform, canonicalValue);
        }),
      );
    },
    [editingPlatformId],
  );

  const handleShortcutFocus = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      configApi?.suspendShortcuts?.();
      event.currentTarget.select();
    },
    [configApi],
  );

  const handleShortcutBlur = React.useCallback(() => {
    configApi?.resumeShortcuts?.();
  }, [configApi]);

  const handleNameChange = React.useCallback(
    (id: string, value: string) => {
      if (editingPlatformId === id) {
        setEditingPlatformDraft((previous) =>
          previous ? { ...previous, name: value } : previous,
        );
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id ? { ...platform, name: value } : platform,
        ),
      );
    },
    [editingPlatformId],
  );

  const handleUrlChange = React.useCallback(
    (id: string, index: number, value: string) => {
      if (editingPlatformId === id) {
        setEditingPlatformDraft((previous) => {
          if (!previous) {
            return previous;
          }
          const updatedUrls = previous.urls.map((entry, entryIndex) => {
            if (entryIndex !== index) {
              return entry;
            }

            return {
              ...entry,
              url: value,
              chain: extractChainSpecFromUrl(value, entry.chain),
            };
          });

          return {
            ...previous,
            urls: updatedUrls,
          };
        });
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) => {
          if (platform.id !== id) {
            return platform;
          }

          const updatedUrls = platform.urls.map((entry, entryIndex) => {
            if (entryIndex !== index) {
              return entry;
            }

            return {
              ...entry,
              url: value,
              chain: extractChainSpecFromUrl(value, entry.chain),
            };
          });

          return {
            ...platform,
            urls: updatedUrls,
          };
        }),
      );
    },
    [editingPlatformId],
  );

  const ensureUniquePlatformName = React.useCallback(
    (baseName: string, existingPlatforms: PlatformConfig[]) => {
      const sanitizedBase = baseName.trim();
      const fallbackName = sanitizedBase || baseName || "Platform";
      const usedNames = new Set(
        existingPlatforms
          .map((platform) => platform.name?.trim().toLowerCase())
          .filter((name): name is string => Boolean(name)),
      );

      if (!usedNames.has(fallbackName.toLowerCase())) {
        return fallbackName;
      }

      let suffix = 2;
      let candidate = `${fallbackName} ${suffix}`;
      while (usedNames.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${fallbackName} ${suffix}`;
      }

      return candidate;
    },
    [],
  );

  const handleAddTemplate = React.useCallback(
    (templateKey: string) => {
      let draft: PlatformConfig | null = null;

      if (templateKey === "custom") {
        const basePlatform = clonePlatformForCustom(
          t("home.customPlatformName"),
          "Any",
          defaultCustomShortcut,
          isPro,
        );
        const uniqueName = ensureUniquePlatformName(
          basePlatform.name,
          platforms,
        );
        const platformWithUniqueName = {
          ...basePlatform,
          name: uniqueName,
        };
        const normalized = normalizePlatformForState(platformWithUniqueName);
        draft = adjustPlatformForTokenType(normalized, normalized.tokenType);
      } else {
        const template = PLATFORM_TEMPLATES.find(
          (item) => item.key === templateKey,
        );
        if (!template) {
          return;
        }

        const duplicateCount = platforms.filter(
          (item) => item.key === templateKey,
        ).length;
        const newPlatform = instantiatePlatformInstance(
          template,
          duplicateCount,
        );
        const uniqueName = ensureUniquePlatformName(
          newPlatform.name,
          platforms,
        );
        const platformWithUniqueName = {
          ...newPlatform,
          name: uniqueName,
        };
        const normalized = normalizePlatformForState(platformWithUniqueName);
        draft = adjustPlatformForTokenType(normalized, normalized.tokenType);
      }

      if (!draft) {
        return;
      }

      setEditingMode("create");
      setEditingPlatformId(draft.id);
      setEditingPlatformDraft(draft);
    },
    [defaultCustomShortcut, ensureUniquePlatformName, isPro, platforms, t],
  );

  const handleEditPlatform = React.useCallback((platform: PlatformConfig) => {
    setEditingMode("edit");
    setEditingPlatformId(platform.id);
    const cloned = clonePlatformConfig(platform);
    setEditingPlatformDraft(
      adjustPlatformForTokenType(cloned, cloned.tokenType),
    );
  }, []);

  const handleDialogClose = React.useCallback(() => {
    setEditingMode(null);
    setEditingPlatformId(null);
    setEditingPlatformDraft(null);
  }, []);

  const handleDeletePlatform = React.useCallback(
    (id: string) => {
      setPlatforms((previous) =>
        previous.filter((platform) => platform.id !== id),
      );
      if (editingPlatformId === id) {
        handleDialogClose();
      }
    },
    [editingPlatformId, handleDialogClose],
  );

  const handleShortcutKeyDown = React.useCallback(
    (id: string, event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Tab") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        event.currentTarget.blur();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        if (editingPlatformId === id) {
          setEditingPlatformDraft((previous) =>
            previous
              ? { ...previous, shortcut: "", accelerator: undefined }
              : previous,
          );
          return;
        }
        setPlatforms((previous) =>
          previous.map((platform) =>
            platform.id === id
              ? { ...platform, shortcut: "", accelerator: undefined }
              : platform,
          ),
        );
        return;
      }

      const formatted = formatShortcutFromEvent(event, shortcutLabels);
      if (!formatted) {
        return;
      }

      const accelerator = convertDisplayShortcutToAccelerator(formatted);

      if (editingPlatformId === id) {
        setEditingPlatformDraft((previous) =>
          previous
            ? {
                ...previous,
                shortcut: formatted,
                accelerator: accelerator ?? previous.accelerator,
              }
            : previous,
        );
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id
            ? {
                ...platform,
                shortcut: formatted,
                accelerator: accelerator ?? platform.accelerator,
              }
            : platform,
        ),
      );
    },
    [editingPlatformId, shortcutLabels],
  );

  const handleDialogSave = React.useCallback(() => {
    if (!editingPlatformId || !editingPlatformDraft) {
      return;
    }

    const nextPlatform = normalizePlatformForState(editingPlatformDraft);

    setPlatforms((previous) => {
      const existingIndex = previous.findIndex(
        (platform) => platform.id === editingPlatformId,
      );
      if (existingIndex >= 0) {
        return previous.map((platform) =>
          platform.id === editingPlatformId ? nextPlatform : platform,
        );
      }
      const uniqueName = ensureUniquePlatformName(nextPlatform.name, previous);
      return [
        ...previous,
        {
          ...nextPlatform,
          name: uniqueName,
        },
      ];
    });
    handleDialogClose();
  }, [
    editingPlatformDraft,
    editingPlatformId,
    ensureUniquePlatformName,
    handleDialogClose,
  ]);

  const statusContent = {
    saving: {
      label: t("home.status.saving"),
      icon: <Loader2 className="text-primary size-4 animate-spin" />,
    },
    saved: {
      label: t("home.status.saved"),
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    },
    failed: {
      label: t("home.status.failed"),
      icon: <AlertCircle className="size-4 text-red-500" />,
    },
  } satisfies Record<SaveStatus, { label: string; icon: React.ReactNode }>;

  const isEditingDialogOpen = editingMode !== null;
  const dialogPlatform = editingPlatformDraft;
  const dialogPlatformId = dialogPlatform?.id ?? editingPlatformId ?? "new";
  const dialogTokenOptions = dialogPlatform
    ? buildTokenOptions(dialogPlatform)
    : [];
  const dialogTokenValue =
    dialogPlatform && dialogTokenOptions.length > 0
      ? (canonicalizeTokenType(dialogPlatform.tokenType) ??
        dialogTokenOptions[0] ??
        "Any")
      : "Any";

  return (
    <div className="bg-muted dark:bg-primary-foreground relative flex h-full flex-col">
      {statusVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-end px-4">
          <div className="bg-background text-foreground ring-border pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg ring-1 transition duration-200">
            {statusContent[status].icon}
            <span>{statusContent[status].label}</span>
          </div>
        </div>
      )}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.upgradeDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("home.upgradeDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-row sm:justify-end sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">{t("buttons.cancel")}</Button>
            </DialogClose>
            <Button asChild>
              <Link to="/second" onClick={() => setUpgradeDialogOpen(false)}>
                {t("buttons.upgrade")}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isEditingDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose();
          }
        }}
      >
        {dialogPlatform ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("home.dialog.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor={`platform-name-${dialogPlatformId}`}>
                  {t("home.dialog.name")}
                </Label>
                <Input
                  id={`platform-name-${dialogPlatformId}`}
                  value={dialogPlatform.name}
                  onChange={(event) =>
                    handleNameChange(dialogPlatformId, event.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium sm:min-w-[80px]">
                    {t("home.dialog.tokenType")}
                  </Label>
                  <Select
                    value={dialogTokenValue}
                    onValueChange={(value) =>
                      handleTokenTypeChange(dialogPlatformId, value)
                    }
                  >
                    <SelectTrigger className="sm:max-w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dialogTokenOptions.map((token) => (
                        <SelectItem key={token} value={token}>
                          {token}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor={`platform-shortcut-${dialogPlatformId}`}
                    className="text-sm font-medium sm:min-w-[80px]"
                  >
                    {t("home.dialog.shortcut")}
                  </Label>
                  <Input
                    id={`platform-shortcut-${dialogPlatformId}`}
                    value={dialogPlatform.shortcut}
                    readOnly
                    onFocus={handleShortcutFocus}
                    onBlur={handleShortcutBlur}
                    onKeyDown={(event) =>
                      handleShortcutKeyDown(dialogPlatformId, event)
                    }
                    className="sm:max-w-[220px]"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">
                  {t("home.dialog.tokenUrlsTitle")}
                </Label>
                <div className="space-y-2">
                  {dialogPlatform.urls.map((entry, entryIndex) => {
                    const chainLabel = getChainDisplayLabel(
                      entry.chain,
                      dialogPlatform.tokenType,
                    );
                    return (
                      <InputGroup key={`${dialogPlatformId}-${entryIndex}`}>
                        <InputGroupAddon className="min-w-[64px] justify-start">
                          {chainLabel}
                        </InputGroupAddon>
                        <InputGroupInput
                          id={`platform-url-${dialogPlatformId}-${entryIndex}`}
                          value={entry.url}
                          onChange={(event) =>
                            handleUrlChange(
                              dialogPlatformId,
                              entryIndex,
                              event.target.value,
                            )
                          }
                          className="font-mono"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </InputGroup>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("home.dialog.urlHint")}
                </p>
              </div>
            </div>
            <DialogFooter className="sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                {editingMode === "edit" && (
                  <Button
                    variant="destructive"
                    onClick={() => handleDeletePlatform(dialogPlatformId)}
                  >
                    {t("home.platformCard.delete")}
                  </Button>
                )}
              </div>
              <div className="flex flex-1 items-center justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">{t("home.dialog.cancel")}</Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={handleDialogSave}
                  disabled={!dialogPlatform}
                >
                  {t("home.dialog.save")}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 p-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("home.heading")}
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                {t("home.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <LangToggle />
              <ToggleTheme />
              <Button asChild variant="default">
                <Link to="/second">{t("buttons.upgrade")}</Link>
              </Button>
            </div>
          </header>

          <section className="grid flex-1 gap-6 lg:grid-cols-[2fr,1fr]">
            <Card className="flex flex-col">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <CardTitle>{t("home.platformListTitle")}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 size-4" />
                      {t("home.addPlatform")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      {t("home.templatesLabel")}
                    </DropdownMenuLabel>
                    {PLATFORM_TEMPLATES.map((template) => (
                      <DropdownMenuItem
                        key={template.key}
                        onSelect={() => handleAddTemplate(template.key)}
                      >
                        {template.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => handleAddTemplate("custom")}
                    >
                      {t("home.customPlatform")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 pb-6">
                {platforms.length === 0 ? (
                  <div className="text-muted-foreground border-border/80 bg-muted/40 rounded-xl border border-dashed p-6 text-sm">
                    {t("home.emptyPlatformsMessage")}
                  </div>
                ) : (
                  platforms.map((platform) => {
                    const inlineTokenOptions = buildTokenOptions(platform);
                    const inlineTokenValue =
                      canonicalizeTokenType(platform.tokenType) ??
                      inlineTokenOptions[0] ??
                      "Any";
                    const activeTokens = parseChainSpec(inlineTokenValue);
                    const activeTokenSet = new Set(
                      activeTokens.map((token) =>
                        normalizeChainTokenKey(token),
                      ),
                    );
                    const showAllUrls =
                      activeTokenSet.size === 0 || activeTokenSet.has("any");
                    const visibleUrls = platform.urls.filter((entry) => {
                      const entryTokens = parseChainSpec(entry.chain);
                      const entryKeys = entryTokens.map((token) =>
                        normalizeChainTokenKey(token),
                      );
                      if (entryKeys.length === 0 || entryKeys.includes("any")) {
                        return true;
                      }
                      if (showAllUrls) {
                        return true;
                      }
                      return entryKeys.some((tokenKey) =>
                        activeTokenSet.has(tokenKey),
                      );
                    });

                    return (
                      <div
                        key={platform.id}
                        className="border-border/60 bg-muted/40 hover:bg-muted/60 flex flex-col gap-4 rounded-xl border p-4 transition"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold">
                                {platform.name}
                              </h3>
                              {platform.key === "custom" && (
                                <Badge variant="outline">
                                  {t("home.platformCard.customTag")}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start">
                            <Switch
                              checked={platform.enabled}
                              onCheckedChange={(checked) =>
                                handleTogglePlatform(platform.id, checked)
                              }
                              aria-label={t("common.enabled")}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPlatform(platform)}
                            >
                              <Settings2 className="size-4" />
                              <span className="sr-only">
                                {t("home.dialog.title")}
                              </span>
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>
                              {t("home.platformCard.tokenTypeLabel")}
                            </Label>
                            <Select
                              value={inlineTokenValue}
                              onValueChange={(value) =>
                                handleTokenTypeChange(platform.id, value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {inlineTokenOptions.map((token) => (
                                  <SelectItem key={token} value={token}>
                                    {token}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`shortcut-inline-${platform.id}`}>
                              {t("home.platformCard.shortcutLabel")}
                            </Label>
                            <Input
                              id={`shortcut-inline-${platform.id}`}
                              value={platform.shortcut}
                              readOnly
                              onFocus={handleShortcutFocus}
                              onBlur={handleShortcutBlur}
                              onKeyDown={(event) =>
                                handleShortcutKeyDown(platform.id, event)
                              }
                            />
                          </div>
                        </div>
                        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                          {visibleUrls.map((entry, entryIndex) => {
                            const chainLabel = getChainDisplayLabel(
                              entry.chain,
                              inlineTokenValue,
                            );
                            return (
                              <span
                                key={`${platform.id}-${entryIndex}`}
                                className="font-mono"
                              >
                                {chainLabel ? `[${chainLabel}] ` : ""}
                                {entry.url}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="">
                  <CardTitle className="text-primary">
                    {t("home.executionCardTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="space-y-1 sm:w-1/2">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.browserDelayTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.browserDelayDescription")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:w-1/2 sm:justify-start">
                      <Input
                        value={`${browserDelay / 1000}s`}
                        readOnly
                        disabled
                        className="w-24 text-center"
                      />
                      <Badge variant="secondary">{t("home.delayBadge")}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="space-y-1 sm:w-1/2">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.notificationsTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.notificationsDescription")}
                      </p>
                    </div>
                    <div className="sm:w-1/2">
                      <div className="border-border/60 bg-background/70 flex items-center justify-between rounded-lg border p-3">
                        <p className="text-sm font-medium">
                          {t("home.notificationsToggleLabel")}
                        </p>
                        <Switch
                          checked={notificationsEnabled}
                          onCheckedChange={(checked) =>
                            setNotificationsEnabled(checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
          <div className="border-border/70 mt-1">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
