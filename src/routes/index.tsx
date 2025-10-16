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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
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

const TOKEN_OPTIONS = [
  "BSC",
  "Solana",
  "Base",
  "X Layer",
  "EVM",
  "Any",
  "BSC | Solana",
  "Base | Solana",
  "X Layer | Solana",
] as const;

function instantiatePlatformInstance(
  template: PlatformTemplate,
  index: number,
): PlatformConfig {
  return {
    id: index === 0 ? template.key : `${template.key}-${index}`,
    key: template.key,
    name: template.name,
    tokenType: template.tokenType,
    shortcut: template.shortcut,
    enabled: template.enabled,
    requiresPro: template.requiresPro,
    urls: template.urls.map((entry) => ({ ...entry })),
    accelerator: convertDisplayShortcutToAccelerator(template.shortcut),
  };
}

function clonePlatformForCustom(
  name: string,
  tokenType = "Any",
  shortcutDisplay = "⌘⇧C",
): PlatformConfig {
  return {
    id: `custom-${Date.now()}`,
    key: "custom",
    name,
    tokenType,
    shortcut: shortcutDisplay,
    enabled: true,
    urls: [{ chain: "Any", url: "https://your-platform.com/token/{CA}" }],
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
  return withAccelerator({
    ...platform,
    urls: platform.urls.map((entry) => ({ ...entry })),
  });
}

function HomePage() {
  const { t } = useTranslation();
  const defaultsRef = React.useRef(createDefaultAppConfig());
  const [platforms, setPlatforms] = React.useState<PlatformConfig[]>(
    defaultsRef.current.platforms.map(normalizePlatformForState),
  );
  const [browserDelay, setBrowserDelay] = React.useState<number>(
    defaultsRef.current.browserDelayMs,
  );
  const [notifications, setNotifications] = React.useState({
    ...defaultsRef.current.notifications,
  });
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [statusVisible, setStatusVisible] = React.useState(false);
  const hydrationRef = React.useRef(true);
  const hasStatusMounted = React.useRef(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const defaultCustomShortcut = isMac ? "⌘⇧C" : "Ctrl + Shift + C";

  React.useEffect(() => {
    return () => {
      configApi?.resumeShortcuts?.();
    };
  }, [configApi]);

  React.useEffect(() => {
    let cancelled = false;

    if (!configApi) {
      hydrationRef.current = false;
      setLoading(false);
      return;
    }

    async function loadConfig() {
      try {
        const config = await configApi.getConfig();
        if (cancelled || !config) {
          return;
        }
        hydrationRef.current = true;
        setPlatforms(config.platforms.map(normalizePlatformForState));
        setBrowserDelay(config.browserDelayMs ?? DEFAULT_BROWSER_DELAY);
        setNotifications({
          ...(config.notifications ?? defaultsRef.current.notifications),
        });
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
      notifications,
      browserDelayMs: browserDelay,
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
  }, [browserDelay, configApi, loading, notifications, platforms]);

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
      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id ? { ...platform, enabled: checked } : platform,
        ),
      );
    },
    [],
  );

  const handleTokenTypeChange = React.useCallback(
    (id: string, value: string) => {
      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id ? { ...platform, tokenType: value } : platform,
        ),
      );
    },
    [],
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

  const handleNameChange = React.useCallback((id: string, value: string) => {
    setPlatforms((previous) =>
      previous.map((platform) =>
        platform.id === id ? { ...platform, name: value } : platform,
      ),
    );
  }, []);

  const handleUrlChange = React.useCallback(
    (id: string, chain: string, value: string) => {
      setPlatforms((previous) =>
        previous.map((platform) =>
          platform.id === id
            ? {
                ...platform,
                urls: platform.urls.map((entry) =>
                  entry.chain === chain ? { ...entry, url: value } : entry,
                ),
              }
            : platform,
        ),
      );
    },
    [],
  );

  const handleAddTemplate = React.useCallback(
    (templateKey: string) => {
      if (templateKey === "custom") {
        setPlatforms((previous) => [
          ...previous,
          clonePlatformForCustom(
            t("home.customPlatformName"),
            "Any",
            defaultCustomShortcut,
          ),
        ]);
        return;
      }

      const template = PLATFORM_TEMPLATES.find(
        (item) => item.key === templateKey,
      );
      if (!template) {
        return;
      }

      setPlatforms((previous) => {
        const duplicateCount = previous.filter(
          (item) => item.key === templateKey,
        ).length;
        return [
          ...previous,
          instantiatePlatformInstance(template, duplicateCount),
        ];
      });
    },
    [defaultCustomShortcut, t],
  );

  const handleDeletePlatform = React.useCallback((id: string) => {
    setPlatforms((previous) =>
      previous.filter((platform) => platform.id !== id),
    );
  }, []);

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
    [shortcutLabels],
  );

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
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  platforms.map((platform) => (
                    <div
                      key={platform.id}
                      className="border-border/60 bg-muted/40 hover:bg-muted/60 flex flex-col gap-4 rounded-xl border p-4 transition"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Settings2 className="size-4" />
                                <span className="sr-only">
                                  {t("home.dialog.title")}
                                </span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {t("home.dialog.title")}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor={`platform-name-${platform.id}`}
                                  >
                                    {t("home.dialog.name")}
                                  </Label>
                                  <Input
                                    id={`platform-name-${platform.id}`}
                                    value={platform.name}
                                    onChange={(event) =>
                                      handleNameChange(
                                        platform.id,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Label
                                      htmlFor={`platform-shortcut-${platform.id}`}
                                      className="text-sm font-medium sm:min-w-[140px]"
                                    >
                                      {t("home.dialog.shortcut")}
                                    </Label>
                                    <Input
                                      id={`platform-shortcut-${platform.id}`}
                                      value={platform.shortcut}
                                      readOnly
                                      onFocus={handleShortcutFocus}
                                      onBlur={handleShortcutBlur}
                                      onKeyDown={(event) =>
                                        handleShortcutKeyDown(
                                          platform.id,
                                          event,
                                        )
                                      }
                                      className="sm:max-w-[220px]"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Label className="text-sm font-medium sm:min-w-[140px]">
                                      {t("home.dialog.tokenType")}
                                    </Label>
                                    <Select
                                      value={platform.tokenType}
                                      onValueChange={(value) =>
                                        handleTokenTypeChange(
                                          platform.id,
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger className="sm:max-w-[220px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TOKEN_OPTIONS.map((token) => (
                                          <SelectItem key={token} value={token}>
                                            {token}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>{t("home.dialog.urlTemplates")}</Label>
                                  <div className="space-y-3">
                                    {platform.urls.map((entry) => (
                                      <div
                                        key={`${platform.id}-${entry.chain}`}
                                        className="space-y-1.5"
                                      >
                                        <Label className="text-muted-foreground text-xs uppercase">
                                          {entry.chain}
                                        </Label>
                                        <Textarea
                                          value={entry.url}
                                          onChange={(event) =>
                                            handleUrlChange(
                                              platform.id,
                                              entry.chain,
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-muted-foreground text-xs">
                                    {t("home.dialog.urlHint")}
                                  </p>
                                </div>
                              </div>
                              <DialogFooter className="sm:flex-row sm:items-center sm:justify-between">
                                <DialogClose asChild>
                                  <div className="flex-1">
                                    <Button
                                      variant="destructive"
                                      onClick={() =>
                                        handleDeletePlatform(platform.id)
                                      }
                                    >
                                      {t("home.platformCard.delete")}
                                    </Button>
                                  </div>
                                </DialogClose>
                                <div className="flex flex-1 items-center justify-end gap-2">
                                  <DialogClose asChild>
                                    <Button variant="outline">
                                      {t("home.dialog.cancel")}
                                    </Button>
                                  </DialogClose>
                                  <Button>{t("home.dialog.save")}</Button>
                                </div>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t("home.platformCard.tokenTypeLabel")}</Label>
                          <Select
                            value={platform.tokenType}
                            onValueChange={(value) =>
                              handleTokenTypeChange(platform.id, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TOKEN_OPTIONS.map((token) => (
                                <SelectItem key={token} value={token}>
                                  {token}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
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
                      <div className="space-y-2">
                        <Label>{t("home.platformCard.urlsLabel")}</Label>
                        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                          {platform.urls.map((entry) => (
                            <span key={`${platform.id}-${entry.chain}`}>
                              <strong className="text-foreground mr-2 text-[0.65rem] uppercase">
                                {entry.chain}:
                              </strong>
                              {entry.url}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
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
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.browserDelayTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.browserDelayDescription")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${browserDelay / 1000}s`}
                        readOnly
                        disabled
                        className="w-24 text-center"
                      />
                      <Badge variant="secondary">{t("home.delayBadge")}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-primary text-sm font-semibold">
                        {t("home.notificationsTitle")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("home.notificationsDescription")}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="border-border/60 bg-background/70 flex items-center justify-between rounded-lg border p-3">
                        <p className="text-sm font-medium">
                          {t("home.notificationsSuccess")}
                        </p>
                        <Switch
                          checked={notifications.success}
                          onCheckedChange={(checked) =>
                            setNotifications((previous) => ({
                              ...previous,
                              success: checked,
                            }))
                          }
                        />
                      </div>
                      <div className="border-border/60 bg-background/70 flex items-center justify-between rounded-lg border p-3">
                        <p className="text-sm font-medium">
                          {t("home.notificationsError")}
                        </p>
                        <Switch
                          checked={notifications.error}
                          onCheckedChange={(checked) =>
                            setNotifications((previous) => ({
                              ...previous,
                              error: checked,
                            }))
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
