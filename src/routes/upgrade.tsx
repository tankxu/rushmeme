import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Footer from "@/components/template/Footer";
import ToggleTheme from "@/components/ToggleTheme";
import LangToggle from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import type { LicenseSnapshot } from "@/types/config";

function SecondPage() {
  const { t, i18n } = useTranslation();
  const features = t("pro.featuresList", {
    returnObjects: true,
  }) as string[];
  const [serialKey, setSerialKey] = React.useState("");
  const [license, setLicense] = React.useState<LicenseSnapshot | null>(null);
  const [activating, setActivating] = React.useState(false);
  const [deactivating, setDeactivating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const licenseApi =
    typeof window !== "undefined" ? window.rushLicense : undefined;
  const isActive = license?.status === "active";
  const actionPending = isActive ? deactivating : activating;
  const resolveActivationError = React.useCallback(
    (code?: string | null, message?: string | null) => {
      if (!code && message) {
        return message;
      }
      if (code === "activation_limit_reached") {
        return t("pro.errors.activationLimitReached");
      }
      if (message && message.trim().length > 0) {
        return message;
      }
      return t("pro.errors.activationFailed");
    },
    [t],
  );

  React.useEffect(() => {
    if (!licenseApi?.watch) {
      return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;

    licenseApi
      .watch((snapshot) => {
        setLicense(snapshot);
        setSerialKey((previous) =>
          previous.trim().length > 0 ? previous : (snapshot.key ?? ""),
        );
        setError(null);
      })
      .then((unsubscribe) => {
        if (disposed) {
          unsubscribe();
          return;
        }
        stop = unsubscribe;
      })
      .catch((watchError) => {
        console.error("Failed to subscribe to license updates", watchError);
      });

    return () => {
      disposed = true;
      if (stop) {
        stop();
      }
    };
  }, [licenseApi]);

  React.useEffect(() => {
    if (license || !licenseApi?.getStatus || licenseApi?.watch) {
      return;
    }

    let cancelled = false;
    licenseApi
      .getStatus()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setLicense(snapshot);
        setSerialKey(snapshot.key ?? "");
      })
      .catch((getStatusError) => {
        console.error("Failed to load license status", getStatusError);
      });

    return () => {
      cancelled = true;
    };
  }, [license, licenseApi]);

  const handleActivate = React.useCallback(async () => {
    if (!licenseApi?.activate) {
      setError(t("pro.errors.unavailable"));
      return;
    }

    const trimmedKey = serialKey.trim();
    if (!trimmedKey) {
      setError(t("pro.serialRequired"));
      return;
    }

    setError(null);
    setActivating(true);
    try {
      const result = await licenseApi.activate(trimmedKey);
      if (!result.success) {
        setError(resolveActivationError(result.code, result.message ?? null));
        return;
      }
      setLicense(result.snapshot);
      setSerialKey(result.snapshot.key ?? trimmedKey);
    } catch (activationError) {
      console.error("Activation failed", activationError);
      if (
        activationError &&
        typeof activationError === "object" &&
        "code" in activationError
      ) {
        const code =
          typeof (activationError as { code?: unknown }).code === "string"
            ? (activationError as { code?: string }).code
            : undefined;
        const message =
          activationError instanceof Error
            ? activationError.message
            : undefined;
        setError(resolveActivationError(code, message ?? null));
      } else {
        setError(
          activationError instanceof Error
            ? activationError.message
            : t("pro.errors.activationFailed"),
        );
      }
    } finally {
      setActivating(false);
    }
  }, [licenseApi, resolveActivationError, serialKey, t]);

  const handleDeactivate = React.useCallback(async () => {
    if (!licenseApi?.deactivate) {
      setError(t("pro.errors.unavailable"));
      return;
    }

    setError(null);
    setDeactivating(true);
    try {
      const result = await licenseApi.deactivate();
      if (!result.success) {
        setError(result.message ?? t("pro.errors.deactivationFailed"));
        return;
      }
      setLicense(result.snapshot);
      setSerialKey(result.snapshot.key ?? "");
    } catch (deactivationError) {
      console.error("Deactivation failed", deactivationError);
      setError(
        deactivationError instanceof Error
          ? deactivationError.message
          : t("pro.errors.deactivationFailed"),
      );
    } finally {
      setDeactivating(false);
    }
  }, [licenseApi, t]);

  const handleSerialChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSerialKey(event.target.value);
      if (error && !event.target.value.trim()) {
        return;
      }
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const serialHelperMessage = React.useMemo(() => {
    if (isActive) {
      const messages = [t("pro.serialSuccess")];
      const expiresAt = license?.expiresAt;
      if (expiresAt) {
        const timestamp = Date.parse(expiresAt);
        if (!Number.isNaN(timestamp)) {
          const formatted = new Intl.DateTimeFormat(i18n.language, {
            dateStyle: "medium",
          }).format(new Date(timestamp));
          messages.push(t("pro.serialDate", { date: formatted }));
        } else {
          messages.push(t("pro.serialDataForever"));
        }
      } else {
        messages.push(t("pro.serialDataForever"));
      }
      return messages.join(" ");
    }
    return t("pro.serialHelper");
  }, [i18n.language, isActive, license?.expiresAt, t]);

  return (
    <div className="bg-muted dark:bg-primary-foreground flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
          <header className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" className="!pl-0" asChild>
                <Link to="/">
                  <ArrowLeft className="mr-1 size-[18px]" />
                  {t("titleHomePage")}
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <LangToggle />
                <ToggleTheme />
              </div>
            </div>
            <div className="space-y-3">
              <Badge variant="secondary" className="border-border uppercase">
                Pro • Lifetime
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("pro.heading")}
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                  {t("pro.subtitle")}
                </p>
              </div>
            </div>
          </header>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>{t("pro.priceLabel")}</CardTitle>
              <CardDescription className="text-base">
                {t("pro.priceValue")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {t("pro.devicesInfo")}
              </p>
              <div className="space-y-3">
                <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  {t("pro.featuresTitle")}
                </h2>
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="text-primary mt-0.5 size-4" />
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4">
              <Button className="flex-1">{t("pro.actions.purchase")}</Button>
              <Button variant="outline" className="flex-1" asChild>
                <a href="mailto:support@rushmeme.vip">support@rushmeme.vip</a>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pro.serialTitle")}</CardTitle>
              <CardDescription>{t("pro.serialDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Input
                  id="serial-key"
                  value={serialKey}
                  onChange={handleSerialChange}
                  placeholder={t("pro.serialPlaceholder")}
                  disabled={isActive || actionPending}
                />
              </div>
              <p
                className={`text-xs ${isActive ? "text-brand font-medium" : "text-muted-foreground"}`}
              >
                {serialHelperMessage}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={isActive ? handleDeactivate : handleActivate}
                disabled={
                  actionPending || (!isActive && serialKey.trim().length === 0)
                }
                variant={isActive ? "outline" : "default"}
              >
                {actionPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isActive
                  ? t("pro.actions.removeDevice")
                  : t("pro.actions.redeem")}
              </Button>
            </CardFooter>
            {error && (
              <p className="text-destructive px-6 pb-4 text-sm">{error}</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pro.supportTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {t("pro.supportDescription")}
              </p>
            </CardContent>
          </Card>

          <div className="border-border/70 mt-1">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/upgrade")({
  component: SecondPage,
});
