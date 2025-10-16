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
import { CheckCircle2, ArrowLeft } from "lucide-react";

function SecondPage() {
  const { t } = useTranslation();
  const features = t("pro.featuresList", {
    returnObjects: true,
  }) as string[];
  const [serialKey, setSerialKey] = React.useState("");

  return (
    <div className="bg-muted dark:bg-primary-foreground flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 p-6 pb-24">
          <header className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Button variant="ghost" asChild>
                <Link to="/">
                  <ArrowLeft className="mr-2 size-4" />
                  {t("titleHomePage")}
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <LangToggle />
                <ToggleTheme />
              </div>
            </div>
            <div className="space-y-3">
              <Badge variant="secondary" className="uppercase">
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
                <a href="mailto:pro@rushmeme.app">pro@rushmeme.app</a>
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
                <Label htmlFor="serial-key">{t("pro.serialTitle")}</Label>
                <Input
                  id="serial-key"
                  value={serialKey}
                  onChange={(event) => setSerialKey(event.target.value)}
                  placeholder={t("pro.serialPlaceholder")}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {t("pro.serialHelper")}
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">{t("pro.actions.redeem")}</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pro.supportTitle")}</CardTitle>
              <CardDescription>{t("pro.supportDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
      <div className="border-border/80 bg-muted border-t px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Footer />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/second")({
  component: SecondPage,
});
