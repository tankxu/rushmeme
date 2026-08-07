import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ToggleTheme from "@/components/ToggleTheme";
import LangToggle from "@/components/LangToggle";
import Footer from "@/components/template/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { isMacOS } from "@/utils/platform";
import { convertDisplayShortcutToAccelerator } from "@/utils/shortcut";
import type {
  PlatformConfig,
  PlatformShortcutConfig,
  PlatformTemplate,
} from "@/types/config";
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

type ShortcutConflictMap = Map<string, Map<number, string[]>>;

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt"]);

const SHIFTED_DIGIT_MAP: Record<string, string> = {
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
};

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

  if (event.shiftKey && key.length === 1) {
    key = SHIFTED_DIGIT_MAP[key] ?? key;
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

function preparePlatformShortcuts(
  platform: PlatformConfig | PlatformTemplate,
): {
  shortcuts: PlatformShortcutConfig[];
  primary: PlatformShortcutConfig;
} {
  const baseShortcuts =
    Array.isArray(platform.shortcuts) && platform.shortcuts.length > 0
      ? platform.shortcuts
      : [];

  const fallbackTokenType =
    canonicalizeTokenType(
      "tokenType" in platform ? (platform.tokenType ?? "") : "",
    ) ??
    ("tokenType" in platform && platform.tokenType
      ? platform.tokenType
      : "Any");

  const fallbackShortcut =
    "shortcut" in platform ? (platform.shortcut ?? "") : "";

  const fallbackAccelerator =
    "accelerator" in platform && platform.accelerator
      ? platform.accelerator
      : (convertDisplayShortcutToAccelerator(fallbackShortcut) ?? undefined);

  const source =
    baseShortcuts.length > 0
      ? baseShortcuts
      : [
          {
            tokenType: fallbackTokenType,
            shortcut: fallbackShortcut,
            accelerator: fallbackAccelerator,
          },
        ];

  const sanitized = source.map((entry, index) => {
    const canonicalToken =
      canonicalizeTokenType(entry.tokenType) ??
      (index === 0 ? fallbackTokenType : (entry.tokenType ?? ""));
    const shortcut = entry.shortcut ?? "";
    const accelerator =
      entry.accelerator ??
      convertDisplayShortcutToAccelerator(shortcut) ??
      undefined;
    return {
      tokenType: canonicalToken ?? "",
      shortcut,
      accelerator,
    };
  });

  const [primary] = sanitized;
  return {
    shortcuts: sanitized,
    primary: primary ?? {
      tokenType: fallbackTokenType,
      shortcut: fallbackShortcut,
      accelerator: fallbackAccelerator,
    },
  };
}

function computeShortcutConflicts(
  platforms: PlatformConfig[],
): ShortcutConflictMap {
  const conflicts = new Map<string, Map<number, string[]>>();
  const acceleratorMap = new Map<
    string,
    Array<{
      platformId: string;
      platformName: string;
      shortcutIndex: number;
    }>
  >();

  for (const platform of platforms) {
    const { shortcuts } = preparePlatformShortcuts(platform);
    shortcuts.forEach((entry, index) => {
      const accelerator =
        entry.accelerator ??
        (entry.shortcut
          ? convertDisplayShortcutToAccelerator(entry.shortcut)
          : undefined);
      if (!accelerator) {
        return;
      }
      const normalized = accelerator.toLowerCase();
      const record = {
        platformId: platform.id,
        platformName: platform.name,
        shortcutIndex: index,
      };
      const bucket = acceleratorMap.get(normalized);
      if (bucket) {
        bucket.push(record);
      } else {
        acceleratorMap.set(normalized, [record]);
      }
    });
  }

  for (const entries of acceleratorMap.values()) {
    if (entries.length <= 1) {
      continue;
    }
    for (const entry of entries) {
      const otherNames = Array.from(
        new Set(
          entries
            .filter((candidate) => candidate.platformId !== entry.platformId)
            .map((candidate) => candidate.platformName),
        ),
      );
      if (otherNames.length === 0) {
        continue;
      }
      let platformConflicts = conflicts.get(entry.platformId);
      if (!platformConflicts) {
        platformConflicts = new Map<number, string[]>();
        conflicts.set(entry.platformId, platformConflicts);
      }
      platformConflicts.set(entry.shortcutIndex, otherNames);
    }
  }

  return conflicts;
}

function instantiatePlatformInstance(
  template: PlatformTemplate,
  index: number,
): PlatformConfig {
  const { shortcuts, primary } = preparePlatformShortcuts(template);
  const normalizedUrls = normalizeUrlTemplates(
    template.urls,
    primary.tokenType,
  );
  return {
    id: index === 0 ? template.key : `${template.key}-${index}`,
    key: template.key,
    name: template.name,
    tokenType: primary.tokenType,
    shortcut: primary.shortcut,
    enabled: template.enabled,
    shortcuts,
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(
        entry.url,
        entry.chain ?? primary.tokenType,
      ),
    })),
    accelerator: primary.accelerator,
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

function buildTokenOptions(
  platform: PlatformConfig,
  currentTokenType?: string,
): string[] {
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

  const currentCanonical = canonicalizeTokenType(
    currentTokenType ?? platform.tokenType,
  );
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
  shortcutDisplay = "",
  initiallyEnabled = true,
): PlatformConfig {
  const defaultUrl = "https://your-platform.com/token/{ANY}";
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
  const primaryAccelerator =
    convertDisplayShortcutToAccelerator(shortcutDisplay) ?? undefined;

  return {
    id: `custom-${Date.now()}`,
    key: "custom",
    name,
    tokenType: canonicalTokenType,
    shortcut: shortcutDisplay,
    enabled: initiallyEnabled,
    urls,
    accelerator: primaryAccelerator,
    shortcuts: [
      {
        tokenType: canonicalTokenType,
        shortcut: shortcutDisplay,
        accelerator: primaryAccelerator,
      },
    ],
    variableType: "ANY",
  };
}

function withAccelerator(platform: PlatformConfig): PlatformConfig {
  const { shortcuts, primary } = preparePlatformShortcuts(platform);
  return {
    ...platform,
    tokenType: primary.tokenType,
    shortcut: primary.shortcut,
    accelerator: primary.accelerator ?? platform.accelerator,
    shortcuts,
  };
}

function normalizePlatformForState(platform: PlatformConfig): PlatformConfig {
  const { shortcuts, primary } = preparePlatformShortcuts(platform);
  const normalizedUrls = normalizeUrlTemplates(
    platform.urls,
    primary.tokenType,
  );
  return {
    ...platform,
    tokenType: primary.tokenType,
    shortcut: primary.shortcut,
    accelerator:
      primary.accelerator ??
      convertDisplayShortcutToAccelerator(primary.shortcut),
    shortcuts,
    urls: normalizedUrls.map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(entry.url, entry.chain),
    })),
  };
}

function clonePlatformConfig(platform: PlatformConfig): PlatformConfig {
  const { shortcuts, primary } = preparePlatformShortcuts(platform);
  return {
    ...platform,
    tokenType: primary.tokenType,
    shortcut: primary.shortcut,
    accelerator: primary.accelerator,
    shortcuts: shortcuts.map((entry) => ({ ...entry })),
    urls: platform.urls.map((entry) => ({ ...entry })),
  };
}

function adjustPlatformForTokenType(
  platform: PlatformConfig,
  tokenType: string,
  shortcutIndex = 0,
): PlatformConfig {
  const canonicalTarget = canonicalizeTokenType(tokenType) ?? tokenType;
  const { shortcuts } = preparePlatformShortcuts(platform);
  const updatedShortcuts = shortcuts.map((entry, index) =>
    index === shortcutIndex
      ? {
          ...entry,
          tokenType: canonicalTarget,
        }
      : entry,
  );

  let updatedPlatform: PlatformConfig = {
    ...platform,
    shortcuts: updatedShortcuts,
  };

  const targetTokens = parseChainSpec(canonicalTarget).map((token) =>
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
      canonicalTarget,
    ).map((entry) => ({
      ...entry,
      chain: extractChainSpecFromUrl(entry.url, entry.chain ?? canonicalTarget),
    }));

  const normalizedCurrent = normalizeSource(updatedPlatform.urls);
  const currentByChain = new Map(
    normalizedCurrent.map((entry) => [canonical(entry.chain), entry]),
  );

  if (shortcutIndex !== 0) {
    const normalizedKeys = new Set(
      normalizedCurrent.map((entry) => canonical(entry.chain)),
    );
    const canonicalKey = canonical(canonicalTarget);
    if (!normalizedKeys.has(canonicalKey)) {
      const templateNormalized = template ? normalizeSource(template.urls) : [];
      const templateMatch = templateNormalized.find(
        (entry) => canonical(entry.chain) === canonicalKey,
      );

      let ensuredEntry = templateMatch;
      if (!ensuredEntry) {
        const fallbackSource = template?.urls?.find(
          (entry) => canonical(entry.chain ?? canonicalTarget) === canonicalKey,
        ) ?? {
          chain: canonicalTarget,
          url: "https://example.com/{CA}",
        };
        const [normalizedFallback] = normalizeSource([
          {
            ...fallbackSource,
            chain: extractChainSpecFromUrl(
              fallbackSource.url,
              fallbackSource.chain ?? canonicalTarget,
            ),
          },
        ]);
        ensuredEntry = normalizedFallback;
      }

      updatedPlatform = {
        ...updatedPlatform,
        urls: [...updatedPlatform.urls, ensuredEntry],
      };
    }

    return withAccelerator(updatedPlatform);
  }

  let nextUrls: typeof normalizedCurrent;

  let templateNormalized: typeof normalizedCurrent | undefined;

  if (template) {
    templateNormalized = normalizeSource(template.urls);
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
      updatedPlatform.urls?.[0] ?? {
        chain: canonicalTarget,
        url: "https://example.com/{CA}",
      };
    nextUrls = normalizeSource([
      {
        ...fallbackSource,
        chain: extractChainSpecFromUrl(
          fallbackSource.url,
          fallbackSource.chain ?? canonicalTarget,
        ),
      },
    ]);
  }

  updatedPlatform = {
    ...updatedPlatform,
    tokenType: canonicalTarget,
    urls: nextUrls,
  };

  return withAccelerator(updatedPlatform);
}

function updatePlatformShortcutEntry(
  platform: PlatformConfig,
  index: number,
  changes: Partial<PlatformShortcutConfig>,
): PlatformConfig {
  const { shortcuts } = preparePlatformShortcuts(platform);
  if (shortcuts.length === 0) {
    return withAccelerator({
      ...platform,
      shortcuts: [
        {
          tokenType: changes.tokenType ?? platform.tokenType ?? "Any",
          shortcut: changes.shortcut ?? platform.shortcut ?? "",
          accelerator:
            changes.accelerator ??
            platform.accelerator ??
            convertDisplayShortcutToAccelerator(
              changes.shortcut ?? platform.shortcut ?? "",
            ) ??
            undefined,
        },
      ],
    });
  }

  const targetIndex = Math.max(0, Math.min(index, shortcuts.length - 1));
  const updatedShortcuts = shortcuts.map((entry, idx) =>
    idx === targetIndex ? { ...entry, ...changes } : entry,
  );

  return withAccelerator({
    ...platform,
    shortcuts: updatedShortcuts,
  });
}

function appendPlatformShortcutEntry(
  platform: PlatformConfig,
  entry?: Partial<PlatformShortcutConfig>,
): PlatformConfig {
  const { shortcuts } = preparePlatformShortcuts(platform);
  const tokenTypeCandidate = entry?.tokenType ?? platform.tokenType ?? "Any";
  const shortcutCandidate = entry?.shortcut ?? "";
  const newEntry: PlatformShortcutConfig = {
    tokenType: canonicalizeTokenType(tokenTypeCandidate) ?? tokenTypeCandidate,
    shortcut: shortcutCandidate,
    accelerator:
      entry?.accelerator ??
      convertDisplayShortcutToAccelerator(shortcutCandidate) ??
      undefined,
  };

  return withAccelerator({
    ...platform,
    shortcuts: [...shortcuts, newEntry],
  });
}

function removePlatformShortcutEntry(
  platform: PlatformConfig,
  index: number,
): PlatformConfig {
  const { shortcuts } = preparePlatformShortcuts(platform);
  if (shortcuts.length <= 1 || index <= 0 || index >= shortcuts.length) {
    return platform;
  }
  const filtered = shortcuts.filter((_, idx) => idx !== index);
  return withAccelerator({
    ...platform,
    shortcuts: filtered,
  });
}

function HomePage() {
  const { t } = useTranslation();
  const initialDefaults = React.useMemo(() => createDefaultAppConfig(), []);
  const defaultsRef = React.useRef(initialDefaults);
  const [platforms, setPlatforms] = React.useState<PlatformConfig[]>(
    defaultsRef.current.platforms.map(normalizePlatformForState),
  );
  const [browserDelay, setBrowserDelay] = React.useState<number>(
    defaultsRef.current.browserDelayMs,
  );
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    defaultsRef.current.notifications.enabled,
  );
  const [smartChainCorrectionEnabled, setSmartChainCorrectionEnabled] =
    React.useState(defaultsRef.current.smartChainCorrectionEnabled);
  const [alchemyApiKey, setAlchemyApiKey] = React.useState(
    defaultsRef.current.alchemyApiKey,
  );
  const [excludeActiveApp, setExcludeActiveApp] = React.useState(
    defaultsRef.current.excludeActiveApp,
  );
  const [includeActiveAppOnly, setIncludeActiveAppOnly] = React.useState(
    defaultsRef.current.includeActiveAppOnly,
  );
  const [excludedApps, setExcludedApps] = React.useState<string[]>(
    defaultsRef.current.excludedApps,
  );
  const [includedApps, setIncludedApps] = React.useState<string[]>(
    defaultsRef.current.includedApps,
  );
  const [excludedAppDraft, setExcludedAppDraft] = React.useState("");
  const [includedAppDraft, setIncludedAppDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [statusVisible, setStatusVisible] = React.useState(false);
  const hydrationRef = React.useRef(true);
  const hasStatusMounted = React.useRef(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingPlatformId, setEditingPlatformId] = React.useState<
    string | null
  >(null);
  const [editingPlatformDraft, setEditingPlatformDraft] =
    React.useState<PlatformConfig | null>(null);
  const [editingMode, setEditingMode] = React.useState<
    "create" | "edit" | null
  >(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );
  const isMac = React.useMemo(() => isMacOS(), []);
  const excludedAppsToggleDescription = t("home.excludedAppsToggleDescription");
  const showExcludedAppsToggleDescription =
    excludedAppsToggleDescription.trim().length > 0;
  const includedAppsToggleDescription = t("home.includedAppsToggleDescription");
  const showIncludedAppsToggleDescription =
    includedAppsToggleDescription.trim().length > 0;
  const [toggleConflictTarget, setToggleConflictTarget] = React.useState<
    "exclude" | "include" | null
  >(null);
  const shortcutLabels = React.useMemo(
    () => ({
      meta: isMac ? "⌘" : "Win",
      ctrl: isMac ? "⌃" : "Ctrl",
      alt: isMac ? "⌥" : "Alt",
      shift: isMac ? "⇧" : "Shift",
    }),
    [isMac],
  );

  const inlineShortcutConflicts = React.useMemo(
    () => computeShortcutConflicts(platforms),
    [platforms],
  );

  const dialogShortcutConflicts = React.useMemo(() => {
    if (!editingPlatformDraft) {
      return null;
    }
    const others = platforms.filter(
      (platform) => platform.id !== editingPlatformDraft.id,
    );
    return computeShortcutConflicts([...others, editingPlatformDraft]);
  }, [editingPlatformDraft, platforms]);

  const configApi =
    typeof window !== "undefined" ? window.rushConfig : undefined;

  React.useEffect(() => {
    return () => {
      configApi?.resumeShortcuts?.();
    };
  }, [configApi]);

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
        setPlatforms(config.platforms.map(normalizePlatformForState));
        setBrowserDelay(config.browserDelayMs ?? DEFAULT_BROWSER_DELAY);
        setNotificationsEnabled(
          Boolean(
            config.notifications?.enabled ??
              defaultsRef.current.notifications.enabled,
          ),
        );
        setSmartChainCorrectionEnabled(
          typeof config.smartChainCorrectionEnabled === "boolean"
            ? config.smartChainCorrectionEnabled
            : defaultsRef.current.smartChainCorrectionEnabled,
        );
        setAlchemyApiKey(
          typeof config.alchemyApiKey === "string" ? config.alchemyApiKey : "",
        );
        setExcludeActiveApp(
          typeof config.excludeActiveApp === "boolean"
            ? config.excludeActiveApp
            : defaultsRef.current.excludeActiveApp,
        );
        setIncludeActiveAppOnly(
          typeof config.includeActiveAppOnly === "boolean"
            ? config.includeActiveAppOnly
            : defaultsRef.current.includeActiveAppOnly,
        );
        setExcludedApps(
          Array.isArray(config.excludedApps)
            ? [...config.excludedApps]
            : [...defaultsRef.current.excludedApps],
        );
        setIncludedApps(
          Array.isArray(config.includedApps)
            ? [...config.includedApps]
            : [...defaultsRef.current.includedApps],
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
      smartChainCorrectionEnabled,
      alchemyApiKey,
      excludeActiveApp,
      includeActiveAppOnly,
      excludedApps,
      includedApps,
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
  }, [
    browserDelay,
    alchemyApiKey,
    configApi,
    excludeActiveApp,
    excludedApps,
    includeActiveAppOnly,
    includedApps,
    loading,
    smartChainCorrectionEnabled,
    notificationsEnabled,
    platforms,
  ]);

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

  const handleAddExcludedApp = React.useCallback(() => {
    const candidate = excludedAppDraft.trim();
    if (!candidate) {
      return;
    }

    setExcludedApps((previous) => {
      const exists = previous.some(
        (entry) =>
          entry.localeCompare(candidate, undefined, {
            sensitivity: "accent",
          }) === 0,
      );
      if (exists) {
        return previous;
      }
      return [...previous, candidate];
    });
    setExcludedAppDraft("");
  }, [excludedAppDraft]);

  const handleRemoveExcludedApp = React.useCallback((value: string) => {
    setExcludedApps((previous) =>
      previous.filter(
        (entry) =>
          entry.localeCompare(value, undefined, { sensitivity: "accent" }) !==
          0,
      ),
    );
  }, []);

  const handleExcludedAppKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddExcludedApp();
      }
      if (event.key === "Escape") {
        setExcludedAppDraft("");
      }
    },
    [handleAddExcludedApp],
  );

  const handleAddIncludedApp = React.useCallback(() => {
    const candidate = includedAppDraft.trim();
    if (!candidate) {
      return;
    }

    setIncludedApps((previous) => {
      const exists = previous.some(
        (entry) =>
          entry.localeCompare(candidate, undefined, {
            sensitivity: "accent",
          }) === 0,
      );
      if (exists) {
        return previous;
      }
      return [...previous, candidate];
    });
    setIncludedAppDraft("");
  }, [includedAppDraft]);

  const handleRemoveIncludedApp = React.useCallback((value: string) => {
    setIncludedApps((previous) =>
      previous.filter(
        (entry) =>
          entry.localeCompare(value, undefined, { sensitivity: "accent" }) !==
          0,
      ),
    );
  }, []);

  const handleIncludedAppKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddIncludedApp();
      }
      if (event.key === "Escape") {
        setIncludedAppDraft("");
      }
    },
    [handleAddIncludedApp],
  );

  const handleToggleConflictCancel = React.useCallback(() => {
    setToggleConflictTarget(null);
  }, []);

  const handleToggleConflictConfirm = React.useCallback(() => {
    if (toggleConflictTarget === "include") {
      setIncludeActiveAppOnly(true);
      setExcludeActiveApp(false);
    } else if (toggleConflictTarget === "exclude") {
      setExcludeActiveApp(true);
      setIncludeActiveAppOnly(false);
    }
    setToggleConflictTarget(null);
  }, [toggleConflictTarget]);

  const handleSmartChainCorrectionToggle = React.useCallback(
    (checked: boolean) => {
      setSmartChainCorrectionEnabled(
        checked && alchemyApiKey.trim().length > 0,
      );
    },
    [alchemyApiKey],
  );

  const handleExcludeToggle = React.useCallback(
    (checked: boolean) => {
      if (checked && includeActiveAppOnly) {
        setToggleConflictTarget("exclude");
        return;
      }
      setExcludeActiveApp(checked);
    },
    [includeActiveAppOnly],
  );

  const handleIncludeToggle = React.useCallback(
    (checked: boolean) => {
      if (checked && excludeActiveApp) {
        setToggleConflictTarget("include");
        return;
      }
      setIncludeActiveAppOnly(checked);
    },
    [excludeActiveApp],
  );

  const handleTogglePlatform = React.useCallback(
    (id: string, checked: boolean) => {
      setPlatforms((previous) => {
        const target = previous.find((platform) => platform.id === id);
        if (!target) {
          return previous;
        }

        return previous.map((platform) =>
          platform.id === id ? { ...platform, enabled: checked } : platform,
        );
      });
    },
    [],
  );

  const handleTokenTypeChange = React.useCallback(
    (id: string, shortcutIndex: number, value: string) => {
      const canonicalValue = canonicalizeTokenType(value) ?? value;

      if (editingPlatformId === id) {
        setEditingPlatformDraft((previous) =>
          previous
            ? adjustPlatformForTokenType(
                previous,
                canonicalValue,
                shortcutIndex,
              )
            : previous,
        );
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) => {
          if (platform.id !== id) {
            return platform;
          }

          return adjustPlatformForTokenType(
            platform,
            canonicalValue,
            shortcutIndex,
          );
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

  const handleBrowserDelayChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      if (rawValue.trim().length === 0) {
        setBrowserDelay(0);
        return;
      }
      const parsedSeconds = Number(rawValue);
      if (!Number.isFinite(parsedSeconds)) {
        return;
      }
      const milliseconds = Math.max(0, Math.round(parsedSeconds * 1000));
      setBrowserDelay(milliseconds);
    },
    [],
  );

  const displayedDelaySeconds = React.useMemo(() => {
    const seconds = browserDelay / 1000;
    if (Number.isInteger(seconds)) {
      return String(seconds);
    }
    return seconds.toFixed(1);
  }, [browserDelay]);
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
          "",
          true,
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
    [ensureUniquePlatformName, platforms, t],
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
  const handleConfirmDelete = React.useCallback(() => {
    if (!pendingDeleteId) {
      return;
    }
    handleDeletePlatform(pendingDeleteId);
    setDeleteConfirmOpen(false);
    setPendingDeleteId(null);
  }, [handleDeletePlatform, pendingDeleteId]);

  const handleDialogAddTokenShortcut = React.useCallback(() => {
    if (!editingPlatformId) {
      return;
    }
    setEditingPlatformDraft((previous) =>
      previous ? appendPlatformShortcutEntry(previous) : previous,
    );
  }, [editingPlatformId]);

  const handleDialogRemoveTokenShortcut = React.useCallback((index: number) => {
    setEditingPlatformDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return removePlatformShortcutEntry(previous, index);
    });
  }, []);

  const handleShortcutKeyDown = React.useCallback(
    (
      id: string,
      shortcutIndex: number,
      event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
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
              ? updatePlatformShortcutEntry(previous, shortcutIndex, {
                  shortcut: "",
                  accelerator: undefined,
                })
              : previous,
          );
          return;
        }
        setPlatforms((previous) =>
          previous.map((platform) =>
            platform.id === id
              ? updatePlatformShortcutEntry(platform, shortcutIndex, {
                  shortcut: "",
                  accelerator: undefined,
                })
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
            ? updatePlatformShortcutEntry(previous, shortcutIndex, {
                shortcut: formatted,
                accelerator: accelerator ?? undefined,
              })
            : previous,
        );
        return;
      }

      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id
            ? updatePlatformShortcutEntry(platform, shortcutIndex, {
                shortcut: formatted,
                accelerator: accelerator ?? undefined,
              })
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
          enabled: true,
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
      <Dialog
        open={toggleConflictTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToggleConflictTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("home.applicationFiltersConflictTitle")}
            </DialogTitle>
            <DialogDescription>
              {toggleConflictTarget
                ? t(
                    `home.applicationFiltersConflictDescription.${toggleConflictTarget}`,
                  )
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-row sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleToggleConflictCancel}
            >
              {t("home.applicationFiltersConflictCancel")}
            </Button>
            <Button type="button" onClick={handleToggleConflictConfirm}>
              {t("home.applicationFiltersConflictConfirm")}
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
              <div className="space-y-3">
                {dialogPlatform.shortcuts.map(
                  (shortcutEntry, shortcutIndex) => {
                    const tokenOptions = buildTokenOptions(
                      dialogPlatform,
                      shortcutEntry.tokenType,
                    );
                    const tokenValue =
                      canonicalizeTokenType(shortcutEntry.tokenType) ??
                      tokenOptions[0] ??
                      "Any";
                    const conflictNames =
                      dialogShortcutConflicts
                        ?.get(dialogPlatform.id)
                        ?.get(shortcutIndex) ?? null;
                    const conflictHint =
                      conflictNames && conflictNames.length > 0
                        ? t("home.shortcutConflictHint", {
                            platforms: conflictNames.join("、"),
                          })
                        : null;
                    const canRemoveTokenType = shortcutIndex > 0;
                    return (
                      <div
                        key={`${dialogPlatformId}-shortcut-${shortcutIndex}`}
                        className="grid w-full gap-4 sm:grid-cols-2 sm:items-start"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm font-medium">
                              {t("home.dialog.tokenType")}
                            </Label>
                            {canRemoveTokenType ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-5"
                                onClick={() =>
                                  handleDialogRemoveTokenShortcut(shortcutIndex)
                                }
                              >
                                <Trash2 className="size-4" />
                                <span className="sr-only">
                                  {t("home.dialog.removeTokenType")}
                                </span>
                              </Button>
                            ) : null}
                          </div>
                          <Select
                            value={tokenValue}
                            onValueChange={(value) =>
                              handleTokenTypeChange(
                                dialogPlatformId,
                                shortcutIndex,
                                value,
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tokenOptions.map((token) => (
                                <SelectItem key={token} value={token}>
                                  {token}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium">
                            {t("home.dialog.shortcut")}
                          </Label>
                          <Input
                            id={`platform-shortcut-${dialogPlatformId}-${shortcutIndex}`}
                            value={shortcutEntry.shortcut}
                            readOnly
                            onFocus={handleShortcutFocus}
                            onBlur={handleShortcutBlur}
                            onKeyDown={(event) =>
                              handleShortcutKeyDown(
                                dialogPlatformId,
                                shortcutIndex,
                                event,
                              )
                            }
                            placeholder={t("home.shortcutPlaceholder")}
                            className={
                              shortcutEntry.shortcut?.trim()
                                ? "tracking-[0.15em]"
                                : undefined
                            }
                          />
                          {conflictHint ? (
                            <span className="text-muted-foreground/60 text-xs">
                              {conflictHint}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                )}
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm font-medium text-cyan-500 hover:no-underline"
                  onClick={() => handleDialogAddTokenShortcut()}
                >
                  {t("home.dialog.addTokenType")}
                </Button>
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
                  {t("home.dialog.urlHint", {
                    placeholder:
                      dialogPlatform?.variableType === "ANY" ? "{ANY}" : "{CA}",
                    target: t(
                      dialogPlatform?.variableType === "ANY"
                        ? "home.dialog.urlHintTargetAny"
                        : "home.dialog.urlHintTargetContract",
                    ),
                  })}
                </p>
              </div>
            </div>
            <DialogFooter className="sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center justify-end gap-2">
                {editingMode === "edit" && (
                  <Button
                    variant="link"
                    className="text-destructive px-2 hover:no-underline"
                    onClick={() => {
                      setPendingDeleteId(dialogPlatformId);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    {t("home.platformCard.delete")}
                  </Button>
                )}
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
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.dialog.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("home.dialog.deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-row sm:justify-end sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">
                {t("home.dialog.deleteConfirmCancel")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!pendingDeleteId}
            >
              {t("home.dialog.deleteConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 p-10">
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
              <Button variant="default" className="gap-2" disabled>
                <BadgeCheck className="size-4" />
                <span>All features included</span>
              </Button>
            </div>
          </header>

          <section className="grid flex-1 gap-6 lg:grid-cols-[2fr,1fr]">
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle>{t("home.platformListTitle")}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="size-4" />
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
                    const shortcuts = platform.shortcuts ?? [];
                    const primaryTokenValue =
                      shortcuts.length > 0
                        ? (canonicalizeTokenType(shortcuts[0].tokenType) ??
                          shortcuts[0].tokenType ??
                          "Any")
                        : (canonicalizeTokenType(platform.tokenType) ??
                          platform.tokenType ??
                          "Any");
                    const activeTokenSet = new Set<string>();
                    const registerTokens = (spec?: string) => {
                      parseChainSpec(spec ?? "")
                        .map((token) => normalizeChainTokenKey(token))
                        .filter(Boolean)
                        .forEach((token) => activeTokenSet.add(token));
                    };
                    shortcuts.forEach((shortcutEntry) =>
                      registerTokens(shortcutEntry.tokenType),
                    );
                    registerTokens(primaryTokenValue);
                    registerTokens(platform.tokenType);
                    if (activeTokenSet.size === 0) {
                      platform.urls.forEach((entry) =>
                        registerTokens(entry.chain),
                      );
                    }
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
                        <div className="flex flex-row items-center justify-between gap-4">
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
                        <div className="space-y-5 sm:space-y-4">
                          {shortcuts.map((shortcutEntry, shortcutIndex) => {
                            const tokenOptions = buildTokenOptions(
                              platform,
                              shortcutEntry.tokenType,
                            );
                            const inlineShortcutToken =
                              canonicalizeTokenType(shortcutEntry.tokenType) ??
                              tokenOptions[0] ??
                              "Any";
                            const conflictNames =
                              inlineShortcutConflicts
                                .get(platform.id)
                                ?.get(shortcutIndex) ?? null;
                            const conflictHint =
                              conflictNames && conflictNames.length > 0
                                ? t("home.shortcutConflictHint", {
                                    platforms: conflictNames.join("、"),
                                  })
                                : null;
                            return (
                              <div
                                key={`${platform.id}-shortcut-${shortcutIndex}`}
                                className="w/full grid gap-4 sm:grid-cols-2 sm:items-start"
                              >
                                <div className="flex flex-col gap-2">
                                  <Label>
                                    {t("home.platformCard.tokenTypeLabel")}
                                  </Label>
                                  <Select
                                    value={inlineShortcutToken}
                                    onValueChange={(value) =>
                                      handleTokenTypeChange(
                                        platform.id,
                                        shortcutIndex,
                                        value,
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {tokenOptions.map((token) => (
                                        <SelectItem key={token} value={token}>
                                          {token}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label
                                    htmlFor={`shortcut-inline-${platform.id}-${shortcutIndex}`}
                                  >
                                    {t("home.platformCard.shortcutLabel")}
                                  </Label>
                                  <Input
                                    id={`shortcut-inline-${platform.id}-${shortcutIndex}`}
                                    value={shortcutEntry.shortcut}
                                    readOnly
                                    onFocus={handleShortcutFocus}
                                    onBlur={handleShortcutBlur}
                                    onKeyDown={(event) =>
                                      handleShortcutKeyDown(
                                        platform.id,
                                        shortcutIndex,
                                        event,
                                      )
                                    }
                                    placeholder={t("home.shortcutPlaceholder")}
                                    className={
                                      shortcutEntry.shortcut?.trim()
                                        ? "tracking-[0.15em]"
                                        : undefined
                                    }
                                  />
                                  {conflictHint ? (
                                    <span className="text-muted-foreground/60 text-xs">
                                      {conflictHint}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                          {visibleUrls.map((entry, entryIndex) => {
                            const chainLabel = getChainDisplayLabel(
                              entry.chain,
                              primaryTokenValue,
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
                      <InputGroup className="w-32">
                        <InputGroupInput
                          type="number"
                          min={0}
                          step={0.1}
                          value={displayedDelaySeconds}
                          onChange={handleBrowserDelayChange}
                          className="text-left"
                          aria-label={t("home.browserDelayTitle")}
                        />
                        <InputGroupAddon align="inline-end">s</InputGroupAddon>
                      </InputGroup>
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

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="space-y-1 sm:w-1/2">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.smartChainCorrectionTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.smartChainCorrectionDescription")}
                      </p>
                    </div>
                    <div className="space-y-3 sm:w-1/2">
                      <div className="border-border/60 bg-background/70 space-y-2 rounded-lg border p-3">
                        <Label htmlFor="alchemy-api-key">
                          {t("home.alchemyApiKeyLabel")}
                        </Label>
                        <Input
                          id="alchemy-api-key"
                          type="password"
                          value={alchemyApiKey}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAlchemyApiKey(value);
                            if (!value.trim()) {
                              setSmartChainCorrectionEnabled(false);
                            }
                          }}
                          placeholder={t("home.alchemyApiKeyPlaceholder")}
                          autoComplete="off"
                        />
                        <p className="text-muted-foreground text-xs">
                          {t("home.alchemyApiKeyDescription")}
                        </p>
                      </div>
                      <div className="border-border/60 bg-background/70 flex items-center justify-between rounded-lg border p-3">
                        <p className="text-sm font-medium">
                          {t("home.smartChainCorrectionToggleLabel")}
                        </p>
                        <Switch
                          checked={smartChainCorrectionEnabled}
                          onCheckedChange={handleSmartChainCorrectionToggle}
                          disabled={!alchemyApiKey.trim()}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="space-y-1 sm:w-1/2">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.excludedAppsTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.excludedAppsDescription")}
                      </p>
                    </div>
                    <div className="space-y-3 sm:w-1/2">
                      <div className="border-border/60 bg-background/70 flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {t("home.excludedAppsToggleLabel")}
                          </p>
                          {showExcludedAppsToggleDescription ? (
                            <p className="text-muted-foreground text-xs">
                              {excludedAppsToggleDescription}
                            </p>
                          ) : null}
                        </div>
                        <Switch
                          checked={excludeActiveApp}
                          onCheckedChange={handleExcludeToggle}
                        />
                      </div>
                      {excludeActiveApp ? (
                        <>
                          <div className="flex flex-row gap-2">
                            <Input
                              value={excludedAppDraft}
                              onChange={(event) =>
                                setExcludedAppDraft(event.target.value)
                              }
                              onKeyDown={handleExcludedAppKeyDown}
                              placeholder={t("home.excludedAppsPlaceholder")}
                            />
                            <Button
                              type="button"
                              onClick={handleAddExcludedApp}
                              disabled={!excludedAppDraft.trim()}
                              className="sm:w-auto"
                            >
                              {t("home.excludedAppsAddButton")}
                            </Button>
                          </div>
                          {excludedApps.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {excludedApps.map((app) => (
                                <Badge
                                  key={app}
                                  variant="secondary"
                                  className="flex items-center gap-1 py-1 pr-1 pl-2"
                                >
                                  <span className="text-xs">{app}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExcludedApp(app)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={t(
                                      "home.excludedAppsRemoveLabel",
                                      {
                                        app,
                                      },
                                    )}
                                  >
                                    <X className="h-3 w-3" strokeWidth={2} />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              {t("home.excludedAppsEmpty")}
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="space-y-1 sm:w-1/2">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.includedAppsTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.includedAppsDescription")}
                      </p>
                    </div>
                    <div className="space-y-3 sm:w-1/2">
                      <div className="border-border/60 bg-background/70 flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {t("home.includedAppsToggleLabel")}
                          </p>
                          {showIncludedAppsToggleDescription ? (
                            <p className="text-muted-foreground text-xs">
                              {includedAppsToggleDescription}
                            </p>
                          ) : null}
                        </div>
                        <Switch
                          checked={includeActiveAppOnly}
                          onCheckedChange={handleIncludeToggle}
                        />
                      </div>
                      {includeActiveAppOnly ? (
                        <>
                          <div className="flex flex-row gap-2">
                            <Input
                              value={includedAppDraft}
                              onChange={(event) =>
                                setIncludedAppDraft(event.target.value)
                              }
                              onKeyDown={handleIncludedAppKeyDown}
                              placeholder={t("home.includedAppsPlaceholder")}
                            />
                            <Button
                              type="button"
                              onClick={handleAddIncludedApp}
                              disabled={!includedAppDraft.trim()}
                              className="sm:w-auto"
                            >
                              {t("home.includedAppsAddButton")}
                            </Button>
                          </div>
                          {includedApps.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {includedApps.map((app) => (
                                <Badge
                                  key={app}
                                  variant="secondary"
                                  className="flex items-center gap-1 py-1 pr-1 pl-2"
                                >
                                  <span className="text-xs">{app}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIncludedApp(app)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={t(
                                      "home.includedAppsRemoveLabel",
                                      {
                                        app,
                                      },
                                    )}
                                  >
                                    <X className="h-3 w-3" strokeWidth={2} />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              {t("home.includedAppsEmpty")}
                            </p>
                          )}
                        </>
                      ) : null}
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
