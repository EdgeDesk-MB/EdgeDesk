"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookieNamePicker, ExchangeNamePicker } from "@/components/bookie-name-picker";
import { Switch } from "@/components/ui/switch";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import type { AppSettings } from "@/lib/services/settings-shared";
import type { ExchangeRow } from "@/lib/db/schema";
import type { ExchangeProviderStatus } from "@/lib/services/exchange/types";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { useOnboarding } from "@/components/help/onboarding-provider";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/app-version";
import { Download, Bell, SlidersHorizontal, BookOpen, Map, RotateCcw, Globe } from "lucide-react";
import { DISPLAY_TIMEZONE_OPTIONS } from "@/lib/display-timezone";
import { TIME_FORMAT_OPTIONS, normalizeTimeFormat } from "@/lib/time-format";

export default function SettingsPage() {
  const { resetAndOpenWelcome } = useOnboarding();
  const { exchanges, refresh: refreshExchanges } = useExchanges();
  const { state, refresh } = useAppState(5000);
  const settings = state?.settings;
  const [prefsTab, setPrefsTab] = useState<"preferences" | "data">("preferences");

  async function setDefaultExchange(id: number) {
    const name = exchanges.find((e) => e.id === id)?.name ?? "Exchange";
    try {
      await api(`/api/exchanges/${id}`, { method: "PATCH", json: { isDefault: true } });
      toast.success(`${name} is now default`);
      refreshExchanges();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  async function patchSettings(patch: Partial<AppSettings>) {
    try {
      await api("/api/settings", { method: "PATCH", json: patch });
      toast.success("Preferences saved");
      await refresh();
    } catch (e) {
      toast.error("Could not save preferences", { description: String(e) });
    }
  }

  return (
    <PageShell>
      <PageHeader
        helpId="settings"
        title="Settings"
        description="Defaults, reminders and data - everything that shapes how EdgeDesk behaves."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Help &amp; about
          </CardTitle>
          <CardDescription>Guides, roadmap and onboarding.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
            <a href="/help">
              <BookOpen className="size-4" /> Help hub
            </a>
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
            <a href="/roadmap">
              <Map className="size-4" /> Roadmap
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={resetAndOpenWelcome}
          >
            <RotateCcw className="size-4" /> Replay welcome tour
          </Button>
          <p className="w-full text-xs text-muted-foreground pt-1">
            EdgeDesk {APP_VERSION_LABEL} ({APP_VERSION})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <Tabs
            value={prefsTab}
            onValueChange={(v) => setPrefsTab(v as typeof prefsTab)}
            className="gap-0"
          >
            <TabsLineBar bleed="card">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
                <TabsTrigger value="data">Data &amp; API</TabsTrigger>
              </TabsList>
            </TabsLineBar>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {prefsTab === "preferences" && settings && (
            <PreferencesPanel
              settings={settings}
              exchanges={exchanges}
              onPatch={patchSettings}
              onSetDefaultExchange={setDefaultExchange}
            />
          )}

          {prefsTab === "data" && (
            <DataApiPanel
              apiConfigured={state?.apiConfigured}
              racingApiConfigured={state?.racingApiConfigured}
              racingResultsTier={state?.racingResultsTier}
              apiUsage={state?.apiUsage}
              racingApiUsage={state?.racingApiUsage}
              exchangeName={state?.exchangeName}
              exchangeStatus={state?.exchangeStatus}
              exchangeProviders={state?.exchangeProviders}
            />
          )}

        </CardContent>
      </Card>

    </PageShell>
  );
}

function PreferencesPanel({
  settings,
  exchanges,
  onPatch,
  onSetDefaultExchange,
}: {
  settings: AppSettings;
  exchanges: ExchangeRow[];
  onPatch: (patch: Partial<AppSettings>) => void;
  onSetDefaultExchange: (id: number) => void;
}) {
  const [stake, setStake] = useState(String(settings.defaultBackStake));
  const [pollMs, setPollMs] = useState(String(settings.dashboardPollMs));
  const defaultExchange = exchanges.find((e) => e.isDefault) ?? exchanges[0] ?? null;

  useEffect(() => {
    setStake(String(settings.defaultBackStake));
    setPollMs(String(settings.dashboardPollMs));
  }, [settings]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4" /> Bet defaults
          </CardTitle>
          <CardDescription>
            Pre-fill Add bet when you open it from the nav. Changes save as you pick them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Default back stake (£)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              onBlur={() => {
                const v = parseFloat(stake);
                if (Number.isFinite(v) && v > 0) onPatch({ defaultBackStake: v });
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default bet type</Label>
            <Select
              value={settings.defaultBetType}
              onValueChange={(v) =>
                onPatch({ defaultBetType: v as AppSettings["defaultBetType"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qualifying">Qualifying</SelectItem>
                <SelectItem value="free_snr">Free bet (SNR)</SelectItem>
                <SelectItem value="free_sr">Free bet (SR)</SelectItem>
                <SelectItem value="risk_free">Risk-free</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default bookie</Label>
            <BookieNamePicker
              label=""
              value={settings.defaultBookmaker}
              onChange={(v) => {
                const trimmed = v.trim();
                if (trimmed && trimmed !== settings.defaultBookmaker) {
                  onPatch({ defaultBookmaker: trimmed });
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default exchange</Label>
            <ExchangeNamePicker
              label=""
              allowCustom={false}
              value={defaultExchange?.name ?? ""}
              onChange={(name) => {
                const ex = exchanges.find(
                  (e) => e.name.toLowerCase() === name.trim().toLowerCase()
                );
                if (ex && ex.id !== defaultExchange?.id) {
                  onSetDefaultExchange(ex.id);
                }
              }}
            />
            {exchanges.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add exchanges on the Accounts page first.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" /> Automation
          </CardTitle>
          <CardDescription>Live dashboard polling, offer reminders and OCR matching.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Offer expiry reminders</p>
              <p className="text-xs text-muted-foreground">
                Toast at {settings.offerReminderDays.join(", ")} days before expiry
              </p>
            </div>
            <Switch
              checked={settings.offerRemindersEnabled}
              onCheckedChange={(v) => onPatch({ offerRemindersEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">OCR auto-match events</p>
              <p className="text-xs text-muted-foreground">
                Link screenshot imports to tracked fixtures when possible
              </p>
            </div>
            <Switch
              checked={settings.ocrAutoMatchEvents}
              onCheckedChange={(v) => onPatch({ ocrAutoMatchEvents: v })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Dashboard refresh (ms)</Label>
            <Input
              type="number"
              step={500}
              min={1000}
              max={60000}
              value={pollMs}
              onChange={(e) => setPollMs(e.target.value)}
              onBlur={() => {
                const v = parseInt(pollMs, 10);
                if (Number.isFinite(v)) onPatch({ dashboardPollMs: v });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Lower = snappier live P&amp;L. The home dashboard picks this up automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4" /> Time &amp; timezone
          </CardTitle>
          <CardDescription>
            Fixture kickoffs and race off-times are shown in this timezone. Defaults to London.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-col gap-1.5 w-full max-w-sm">
            <Label htmlFor="display-timezone">Display timezone</Label>
            <Select
              value={settings.displayTimezone}
              onValueChange={(v) => onPatch({ displayTimezone: v })}
            >
              <SelectTrigger id="display-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 w-full max-w-sm">
            <Label htmlFor="time-format">Time format</Label>
            <Select
              value={settings.timeFormat}
              onValueChange={(v) => onPatch({ timeFormat: normalizeTimeFormat(v) })}
            >
              <SelectTrigger id="time-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applies to every time shown in the app. Manual time entry stays HH:MM.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataApiPanel({
  apiConfigured,
  racingApiConfigured,
  racingResultsTier,
  apiUsage,
  racingApiUsage,
  exchangeName,
  exchangeStatus,
  exchangeProviders,
}: {
  apiConfigured?: boolean;
  racingApiConfigured?: boolean;
  racingResultsTier?: "basic" | "free" | "none";
  apiUsage?: { used: number; budget: number };
  racingApiUsage?: { used: number; budget: number };
  exchangeName?: string;
  exchangeStatus?: ExchangeProviderStatus;
  exchangeProviders?: ExchangeProviderStatus[];
}) {
  const [testingExchange, setTestingExchange] = useState(false);
  const [testingRacing, setTestingRacing] = useState(false);

  async function testRacingApi() {
    setTestingRacing(true);
    try {
      const res = await api<{
        tier: "basic" | "free" | "none";
        resultCount: number;
        message?: string;
      }>("/api/racing/test");
      if (res.tier === "basic") {
        toast.success("Racing API Basic", {
          description: res.message ?? `${res.resultCount} results available today`,
        });
      } else if (res.tier === "free") {
        toast.info("Racing API Free", {
          description:
            res.message ??
            "Racecards work - upgrade to Basic for auto race settlement.",
        });
      } else {
        toast.error("Racing API not configured", {
          description: "Set RACING_API_USERNAME / RACING_API_PASSWORD in .env.local",
        });
      }
    } catch (e) {
      toast.error("Racing API test failed", { description: String(e) });
    } finally {
      setTestingRacing(false);
    }
  }

  async function testExchangeConnection() {
    setTestingExchange(true);
    try {
      const res = await api<{
        providers: Array<ExchangeProviderStatus & { ok: boolean; message?: string }>;
      }>("/api/exchange/test");
      const betfair = res.providers.find((p) => p.provider === "betfair");
      if (betfair?.ok) {
        toast.success("Betfair connected", { description: betfair.message });
      } else {
        toast.error("Betfair connection failed", {
          description: betfair?.message ?? "Check your credentials in .env.local",
        });
      }
    } catch (e) {
      toast.error("Connection test failed", { description: String(e) });
    } finally {
      setTestingExchange(false);
    }
  }

  function exchangeBadgeVariant(
    status?: ExchangeProviderStatus["status"]
  ): "default" | "outline" | "secondary" | "destructive" {
    if (status === "connected") return "default";
    if (status === "unsupported") return "secondary";
    return "outline";
  }

  function exchangeStatusLabel(status?: ExchangeProviderStatus): string {
    if (!status) return "Loading…";
    if (status.status === "connected") {
      return status.feedType === "delayed" ? "Connected (delayed)" : "Connected";
    }
    if (status.status === "not_configured") return "Not configured";
    if (status.status === "unsupported") return "Partner API required";
    return "Disconnected";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your free stack (£0/mo)</CardTitle>
          <CardDescription>
            EdgeDesk is built to run on free API tiers for personal use. Paid upgrades are optional -
            only buy them when the time saved is worth more than the subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
            <li>
              <span className="text-foreground">Racing API Free</span> - today/tomorrow racecards;
              paste real bookie odds on Racing Desk (click a price)
            </li>
            <li>
              <span className="text-foreground">Betfair delayed key</span> - free at
              developer.betfair.com; real lay prices (~1–3 min delay)
            </li>
            <li>
              <span className="text-foreground">API-Football Free</span> - optional; ~100 req/day
              (~1 live match)
            </li>
            <li>
              <span className="text-foreground">Everything else</span> - calculators, offers,
              tracker, OCR, simulator - fully local
            </li>
          </ul>
          <div className="rounded-md border px-3 py-2 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How often free data updates</p>
            <p>
              Racing cards: provider ~3 min (today) / ~15 min (tomorrow); EdgeDesk caches{" "}
              <span className="text-foreground">15 min</span>. Desk UI reloads every 60s from cache.
            </p>
            <p>
              Betfair delayed: prices{" "}
              <span className="text-foreground">~1–3 min behind</span> live (fine pre-race).
            </p>
            <p>
              Football: live scores ~<span className="text-foreground">60s</span>; fixtures list ~
              <span className="text-foreground">10 min</span>; ~1 live match/day on free budget.
            </p>
            <p>Leave the app open during sessions - closing the tab pauses auto sync.</p>
          </div>
          <p className="text-xs text-muted-foreground">
            If you later open EdgeDesk to subscribers, API costs should be covered by plan pricing -
            never by your personal free keys. See{" "}
            <code className="rounded bg-muted px-1 text-[11px]">docs/api-dependencies-and-tiers.md</code>
            .
          </p>
          <div className="rounded-md border px-3 py-2 space-y-2">
            <p className="text-xs font-medium text-foreground">Setup checklist</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                <span>
                  Racing API Free in{" "}
                  <code className="rounded bg-muted px-1">.env.local</code>
                  {racingApiConfigured ? (
                    <span className="text-emerald-600 dark:text-emerald-400"> - done</span>
                  ) : (
                    <span> - set RACING_API_USERNAME / PASSWORD</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                <span>
                  API-Football Free (optional)
                  {apiConfigured ? (
                    <span className="text-emerald-600 dark:text-emerald-400"> - done</span>
                  ) : (
                    <span> - set API_FOOTBALL_KEY or use simulator</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                <span>
                  Betfair delayed key (free) - largest remaining free win
                  {exchangeStatus?.status === "connected" ? (
                    <span className="text-emerald-600 dark:text-emerald-400"> - connected</span>
                  ) : (
                    <span>
                      {" "}
                      - add BETFAIR_APP_KEY / USERNAME / PASSWORD, restart server, Test below
                    </span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                <span>
                  On Racing Desk: click a bookie price to paste real odds; place-refund remembers
                  your last stake/bookie per offer
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Export</CardTitle>
          <CardDescription>Download your data for spreadsheets or backups.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(
            [
              ["bets", "Bets"],
              ["monthly", "Monthly P&L"],
              ["offers", "Offers"],
              ["accounts", "Accounts"],
            ] as const
          ).map(([type, label]) => (
            <Button key={type} variant="outline" className="justify-start gap-2" asChild>
              <a href={`/api/export/csv?type=${type}`} download>
                <Download className="size-4" /> Export {label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API keys</CardTitle>
          <CardDescription>Set in <code className="text-xs">.env.local</code> - restart the dev server after changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span>API-Football</span>
              <Badge variant={apiConfigured ? "default" : "outline"}>
                {apiConfigured ? "Configured" : "Demo mode"}
              </Badge>
            </div>
            {apiUsage && (
              <p className="text-xs text-muted-foreground">
                Today: {apiUsage.used}/{apiUsage.budget} requests (free ~100/day; EdgeDesk caps
                below the limit)
              </p>
            )}
          </div>
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span>The Racing API</span>
              <Badge
                variant={
                  racingResultsTier === "basic"
                    ? "default"
                    : racingApiConfigured
                      ? "secondary"
                      : "outline"
                }
              >
                {racingResultsTier === "basic"
                  ? "Basic (auto settle)"
                  : racingResultsTier === "free" || racingApiConfigured
                    ? "Free (racecards)"
                    : "Not set"}
              </Badge>
            </div>
            {racingApiUsage && racingApiConfigured && (
              <p className="text-xs text-muted-foreground">
                Today: {racingApiUsage.used}/{racingApiUsage.budget} requests (local budget guard)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Stay on Free for personal use. Paid Basic (~£25/mo ballpark) = auto settle; Standard
              (higher) = live bookie odds - only if you outgrow paste-overrides.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={testingRacing || !racingApiConfigured}
              onClick={testRacingApi}
            >
              {testingRacing ? "Testing…" : "Test Racing API"}
            </Button>
          </div>
          <div className="rounded-md border px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span>
                Exchange API
                {exchangeName ? (
                  <span className="text-muted-foreground"> · default {exchangeName}</span>
                ) : null}
              </span>
              <Badge variant={exchangeBadgeVariant(exchangeStatus?.status)}>
                {exchangeStatusLabel(exchangeStatus)}
              </Badge>
            </div>
            {exchangeStatus?.message && (
              <p className="text-xs text-muted-foreground">{exchangeStatus.message}</p>
            )}
          </div>
          {(exchangeProviders ?? []).map((p) => (
            <div
              key={p.provider}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
            >
              <span className="capitalize">{p.provider}</span>
              <Badge variant={exchangeBadgeVariant(p.status)} className="text-[10px]">
                {exchangeStatusLabel(p)}
              </Badge>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void testExchangeConnection()}
            disabled={testingExchange}
          >
            {testingExchange ? "Testing…" : "Test Betfair connection"}
          </Button>
          <p className="text-xs text-muted-foreground pt-1">
            <strong>Betfair:</strong> free delayed app key at developer.betfair.com - set{" "}
            <code className="rounded bg-muted px-1">BETFAIR_APP_KEY</code>,{" "}
            <code className="rounded bg-muted px-1">BETFAIR_USERNAME</code>,{" "}
            <code className="rounded bg-muted px-1">BETFAIR_PASSWORD</code>. If login says 2FA
            required, also set{" "}
            <code className="rounded bg-muted px-1">BETFAIR_TOTP_SECRET</code> (Authenticator
            base32 secret). Restart after changes, then Test. Set your default exchange in
            Preferences - Racing Desk can still override for that page only.{" "}
            <strong>Betdaq:</strong> partner API only - placeholder until credentials available.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
