"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
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
import { DataCustodyCard } from "@/components/settings/data-custody-card";
import { DemoModeCard } from "@/components/settings/demo-mode-card";
import { PushDeviceControl } from "@/components/settings/push-device-control";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import { Switch } from "@/components/ui/switch";
import { api, useAppState } from "@/hooks/use-app-state";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { LEGAL_PATHS } from "@/lib/legal/public";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  DEFAULT_TUNING,
  normalizeMobileDeckPin,
  type AppSettings,
  type TuningSettings,
} from "@/lib/services/settings-shared";
import { EFFORT_MINUTES } from "@/lib/offers/do-next";
import {
  HOME_WIDGET_LABELS,
  moveWidget,
  toggleDeckHidden,
  type HomeLayoutSettings,
  type HomeWidgetId,
} from "@/lib/ui/home-layout";
import type { ExchangeRow } from "@/lib/db/schema";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { useOnboarding } from "@/components/help/onboarding-provider";
import { ThemeSelect } from "@/components/theme-select";
import { BrandAccentSelect } from "@/components/brand-accent-select";
import { UiFontSelect } from "@/components/ui-font-select";
import { HeaderPatternSelect } from "@/components/header-pattern-select";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/app-version";
import type { BrandAccentPresetId } from "@/lib/brand-accent";
import type { UiFontId } from "@/lib/ui-font";
import type { HeaderPatternId } from "@/lib/header-pattern";
import { Bell, BellRing, ChevronDown, ChevronUp, Download, Gauge, LayoutGrid, Palette, SlidersHorizontal, BookOpen, Map, RotateCcw, Target, Globe } from "lucide-react";
import { DISPLAY_TIMEZONE_OPTIONS } from "@/lib/display-timezone";
import { TIME_FORMAT_OPTIONS, normalizeTimeFormat } from "@/lib/time-format";
import { SPORTS } from "@/lib/sports";
import { SportLabel } from "@/components/sport-icon";
import { edgePanel, sectionDescription } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { publicDemoPlansHref } from "@/lib/demo/public-demo";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { FEATURE_LOCK_BODIES } from "@/lib/entitlements/nav";

const SETTINGS_TABS = [
  "subscription",
  "appearance",
  "bet-defaults",
  "automation",
  "alerts",
  "targets",
  "home-layout",
  "time",
  "data",
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

export default function SettingsPage() {
  const { resetAndOpenWelcome, openSetup } = useOnboarding();
  const { exchanges, refresh: refreshExchanges } = useExchanges();
  const { state, refresh } = useAppState(5000);
  const { active: publicDemo } = usePublicDemo();
  const searchParams = useSearchParams();
  const router = useRouter();
  const settings = state?.settings;
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<SettingsTab>(() =>
    requestedTab && isSettingsTab(requestedTab) ? requestedTab : "subscription"
  );

  useEffect(() => {
    if (searchParams.get("tab") === "integrations") {
      router.replace("/admin/feeds");
    }
  }, [router, searchParams]);

  function selectTab(next: string) {
    if (!isSettingsTab(next)) return;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

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
        description="Defaults, reminders and data - everything that shapes how Edgeways behaves."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Help &amp; about
          </CardTitle>
          <CardDescription>Guides, roadmap and onboarding.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" className="justify-start gap-2" asChild>
            <a href="/help">
              <BookOpen className="size-4" /> Help hub
            </a>
          </Button>
          <Button variant="outline" className="justify-start gap-2" asChild>
            <a href="/roadmap">
              <Map className="size-4" /> Roadmap
            </a>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={resetAndOpenWelcome}
          >
            <RotateCcw className="size-4" /> Replay welcome tour
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={openSetup}
          >
            <SlidersHorizontal className="size-4" /> Set-up wizard
          </Button>
          <p className="w-full text-xs text-muted-foreground pt-1">
            Edgeways {APP_VERSION_LABEL} ({APP_VERSION})
          </p>
          <p className="w-full text-xs text-muted-foreground">
            <a
              href={LEGAL_PATHS.terms}
              className="text-primary-text underline underline-offset-2"
            >
              Terms
            </a>
            {" · "}
            <a
              href={LEGAL_PATHS.privacy}
              className="text-primary-text underline underline-offset-2"
            >
              Privacy
            </a>
            {" · "}
            <a
              href={LEGAL_PATHS.contact}
              className="text-primary-text underline underline-offset-2"
            >
              Contact
            </a>
            {" · "}
            <a
              href={LEGAL_PATHS.refund}
              className="text-primary-text underline underline-offset-2"
            >
              Refunds
            </a>
          </p>
          <ResponsibleGamblingNote className="w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <Tabs value={tab} onValueChange={selectTab} className="gap-0">
            <TabsLineBar bleed="card">
              <TabsList variant="line" className="justify-start">
                <TabsTrigger value="subscription">Subscription</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="bet-defaults">Bet defaults</TabsTrigger>
                <TabsTrigger value="automation">Automation</TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
                <TabsTrigger value="targets">Targets &amp; tuning</TabsTrigger>
                <TabsTrigger value="home-layout">Home layout</TabsTrigger>
                <TabsTrigger value="time">Time &amp; region</TabsTrigger>
                <TabsTrigger value="data">Data &amp; backup</TabsTrigger>
              </TabsList>
            </TabsLineBar>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {tab === "subscription" && (
            <SubscriptionCard
              planPreview={settings?.planPreview ?? "unlocked"}
              onPatch={publicDemo ? undefined : patchSettings}
            />
          )}

          {tab === "appearance" && (
            <AppearanceCard
              onPersistFont={
                publicDemo
                  ? undefined
                  : async (fontId) => {
                      try {
                        await api("/api/settings", {
                          method: "PATCH",
                          json: { uiFont: fontId },
                        });
                        await refresh();
                      } catch (e) {
                        toast.error("Could not save font", {
                          description: String(e),
                        });
                      }
                    }
              }
              onPersistPattern={
                publicDemo
                  ? undefined
                  : async (patternId) => {
                      try {
                        await api("/api/settings", {
                          method: "PATCH",
                          json: { headerPattern: patternId },
                        });
                        await refresh();
                      } catch (e) {
                        toast.error("Could not save header pattern", {
                          description: String(e),
                        });
                      }
                    }
              }
              onPersistAccent={
                publicDemo
                  ? undefined
                  : async (presetId, hex) => {
                      try {
                        await api("/api/settings", {
                          method: "PATCH",
                          json: {
                            brandAccentPreset: presetId,
                            brandAccentHex: hex,
                          },
                        });
                        await refresh();
                      } catch (e) {
                        toast.error("Could not save brand colour", {
                          description: String(e),
                        });
                      }
                    }
              }
            />
          )}

          {tab === "bet-defaults" && settings && (
            <BetDefaultsCard
              settings={settings}
              exchanges={exchanges}
              onPatch={patchSettings}
              onSetDefaultExchange={setDefaultExchange}
            />
          )}

          {tab === "automation" && settings && (
            <AutomationCard settings={settings} onPatch={patchSettings} />
          )}

          {tab === "alerts" && settings && (
            <AlertsCard settings={settings} onPatch={patchSettings} />
          )}

          {tab === "targets" && settings && (
            <div className="flex flex-col gap-4">
              <TargetCard target={settings.monthlyProfitTarget} onPatch={patchSettings} />
              <TuningCard tuning={settings.tuning} onPatch={patchSettings} />
            </div>
          )}

          {tab === "home-layout" && settings && (
            <HomeLayoutCard layout={settings.homeLayout} onPatch={patchSettings} />
          )}

          {tab === "time" && settings && (
            <TimeRegionCard settings={settings} onPatch={patchSettings} />
          )}

          {tab === "data" && (
            <DataBackupPanel onRefresh={refresh} hosted={state?.hostedDesk ?? false} />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function AppearanceCard({
  onPersistFont,
  onPersistPattern,
  onPersistAccent,
}: {
  onPersistFont?: (fontId: UiFontId) => void;
  onPersistPattern?: (patternId: HeaderPatternId) => void;
  onPersistAccent?: (presetId: BrandAccentPresetId, hex: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-muted-foreground" aria-hidden />
          <Label className="text-sm font-semibold">Theme</Label>
        </div>
        <p className={sectionDescription}>Light or dark.</p>
        <ThemeSelect className="max-w-xs" />
      </div>

      <div className="h-px bg-border" />

      <UiFontSelect onPersist={onPersistFont} />

      <div className="h-px bg-border" />

      <BrandAccentSelect onPersist={onPersistAccent} />

      <div className="h-px bg-border" />

      <HeaderPatternSelect onPersist={onPersistPattern} />
    </div>
  );
}

/**
 * G1 - monthly profit target. Home's Monthly P&L chip shows factual pace
 * against it ("£162 of £250 · on pace"); clearing the field removes the copy.
 */
function TargetCard({
  target,
  onPatch,
}: {
  target: number | null;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft == null) return;
    const trimmed = draft.trim();
    const v = parseFloat(trimmed);
    if (trimmed === "" || v === 0) onPatch({ monthlyProfitTarget: null });
    else if (Number.isFinite(v) && v > 0) onPatch({ monthlyProfitTarget: v });
    setDraft(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4" /> Monthly target
        </CardTitle>
        <CardDescription>
          Home shows factual pace against it, nothing more. A bad-variance week is not
          &ldquo;behind plan&rdquo; if the edge was captured. Leave empty for no target.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor={inputId}>Monthly profit target (£)</Label>
          <Input
            id={inputId}
            type="number"
            min={0}
            step="10"
            placeholder="No target"
            value={draft ?? (target != null ? String(target) : "")}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * E2 - Home widget order and visibility. Row order mirrors the mobile deck;
 * up/down moves a widget in the deck, the switches control each mode.
 * Desktop keeps its designed composition, so it only supports show/hide.
 */
function HomeLayoutCard({
  layout,
  onPatch,
}: {
  layout: HomeLayoutSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  function commit(next: Partial<HomeLayoutSettings>) {
    onPatch({ homeLayout: { ...layout, ...next } });
  }

  function toggle(list: HomeWidgetId[], id: HomeWidgetId, visible: boolean): HomeWidgetId[] {
    return visible ? list.filter((x) => x !== id) : [...new Set([...list, id])];
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="size-4" /> Home layout
        </CardTitle>
        <CardDescription>
          Choose which widgets Home shows and the order of the mobile deck. Desktop keeps its
          two-column layout, so it supports show and hide. At least one widget always stays.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* pr-4 = row px-3 + inner pr-1, so captions sit over the switch columns */}
        <div className="flex items-center justify-end gap-4 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="w-12 text-center">Desktop</span>
          <span className="w-12 text-center">Deck</span>
        </div>
        {layout.deckOrder.map((id, i) => (
          <div
            key={id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-1">
              <div
                className={cn("flex flex-col", id === "chart" && "invisible")}
                aria-hidden={id === "chart"}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  aria-label={`Move ${HOME_WIDGET_LABELS[id]} up in the deck`}
                  disabled={id === "chart" || i === 0}
                  onClick={() => commit({ deckOrder: moveWidget(layout.deckOrder, id, -1) })}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  aria-label={`Move ${HOME_WIDGET_LABELS[id]} down in the deck`}
                  disabled={id === "chart" || i === layout.deckOrder.length - 1}
                  onClick={() => commit({ deckOrder: moveWidget(layout.deckOrder, id, 1) })}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{HOME_WIDGET_LABELS[id]}</p>
                {id === "chart" ? (
                  <p className="text-xs text-muted-foreground">Sits on Summary on the phone</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4 pr-1">
              <span className="flex w-12 justify-center">
                <Switch
                  checked={!layout.desktopHidden.includes(id)}
                  aria-label={`Show ${HOME_WIDGET_LABELS[id]} on desktop`}
                  onCheckedChange={(v) =>
                    commit({ desktopHidden: toggle(layout.desktopHidden, id, v) })
                  }
                />
              </span>
              <span className="flex w-12 justify-center">
                <Switch
                  checked={!layout.deckHidden.includes(id)}
                  aria-label={
                    id === "chart"
                      ? "Show Chart on the mobile Summary"
                      : `Show ${HOME_WIDGET_LABELS[id]} in the mobile deck`
                  }
                  onCheckedChange={(v) =>
                    commit({ deckHidden: toggleDeckHidden(layout.deckHidden, id, v) })
                  }
                />
              </span>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Hidden widgets stay reachable from their own pages - the tracker chart, the offers
          calendar and the history feed. On the phone, Chart sits on Summary rather than its
          own card. Showing Chart turns Summary back on; hiding Summary hides Chart too.
        </p>
      </CardContent>
    </Card>
  );
}

/** One tunable number: label + hint, right-aligned input, reset when off-default. */
function TuningNumberRow({
  label,
  hint,
  value,
  defaultValue,
  min,
  max,
  step,
  percent,
  onCommit,
}: {
  label: string;
  hint: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  /** Display and edit as 0-100 while storing 0-1 */
  percent?: boolean;
  onCommit: (value: number) => void;
}) {
  const inputId = useId();
  // null = mirror the saved value; string only while the user is editing.
  const [draft, setDraft] = useState<string | null>(null);
  const display = (v: number) => (percent ? Math.round(v * 100 * 100) / 100 : v);
  const isDefault = value === defaultValue;

  function commitDraft() {
    if (draft != null) {
      const raw = parseFloat(draft);
      if (Number.isFinite(raw)) onCommit(percent ? raw / 100 : raw);
    }
    setDraft(null);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">
          {hint} · default {display(defaultValue)}
          {percent ? "%" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!isDefault ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Reset ${label} to default`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setDraft(null);
              onCommit(defaultValue);
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
        <Input
          id={inputId}
          type="number"
          className="h-8 w-24 text-right"
          min={percent ? min * 100 : min}
          max={percent ? max * 100 : max}
          step={step ?? 1}
          value={draft ?? String(display(value))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

const EFFORT_ROWS: Array<{ kind: keyof typeof EFFORT_MINUTES; label: string }> = [
  { kind: "start_planned", label: "Start a planned offer" },
  { kind: "place_qualifying", label: "Place qualifying bet" },
  { kind: "convert_free_bet", label: "Convert a free bet" },
  { kind: "orphan_free_bet", label: "Convert an orphan free bet" },
  { kind: "review_expiry", label: "Review an expiring offer" },
];

/**
 * E1 - every behaviour-defining threshold, user-tunable. Defaults reproduce
 * the shipped behaviour exactly, so an untouched card changes nothing.
 */
function TuningCard({
  tuning,
  onPatch,
}: {
  tuning: TuningSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  function patchField<K extends keyof TuningSettings>(key: K, value: TuningSettings[K]) {
    onPatch({ tuning: { ...tuning, [key]: value } });
  }

  function patchEffort(kind: string, value: number, defaultValue: number) {
    const next = { ...tuning.effortMinutes };
    if (value === defaultValue) delete next[kind];
    else next[kind] = value;
    onPatch({ tuning: { ...tuning, effortMinutes: next } });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" /> Tuning
        </CardTitle>
        <CardDescription>
          The thresholds behind sentinels, nudges and rankings. Defaults match how Edgeways has
          always behaved - tune them to how you actually operate.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <TuningNumberRow
          label="Unhedged grace period (minutes)"
          hint="Time between logging a back and its lay before the sentinel alerts"
          value={tuning.nakedExposureMinutes}
          defaultValue={DEFAULT_TUNING.nakedExposureMinutes}
          min={1}
          max={1440}
          onCommit={(v) => patchField("nakedExposureMinutes", v)}
        />
        <TuningNumberRow
          label="Unhedged grace near the off (minutes)"
          hint="Tightened grace when the event starts within the hour or is in play"
          value={tuning.nakedImminentMinutes}
          defaultValue={DEFAULT_TUNING.nakedImminentMinutes}
          min={0}
          max={1440}
          onCommit={(v) => patchField("nakedImminentMinutes", v)}
        />
        <TuningNumberRow
          label="Offer drought nudge (days)"
          hint="Days without an offer before a bookie earns “Mark as cooling?”"
          value={tuning.droughtNudgeDays}
          defaultValue={DEFAULT_TUNING.droughtNudgeDays}
          min={1}
          max={365}
          onCommit={(v) => patchField("droughtNudgeDays", v)}
        />
        <TuningNumberRow
          label="Mistake tag prompt (% captured)"
          hint="Settled campaigns capturing less than this ask “What went wrong?”"
          value={tuning.mistakeCapturePct}
          defaultValue={DEFAULT_TUNING.mistakeCapturePct}
          min={0}
          max={1}
          step={5}
          percent
          onCommit={(v) => patchField("mistakeCapturePct", v)}
        />
        <TuningNumberRow
          label="Retention prior (%)"
          hint="Assumed free-bet retention until your own conversions outweigh it"
          value={tuning.retentionPrior}
          defaultValue={DEFAULT_TUNING.retentionPrior}
          min={0}
          max={1}
          step={5}
          percent
          onCommit={(v) => patchField("retentionPrior", v)}
        />
        <TuningNumberRow
          label="Retention prior weight (conversions)"
          hint="How many conversions the prior counts for in the blend"
          value={tuning.retentionPriorWeight}
          defaultValue={DEFAULT_TUNING.retentionPriorWeight}
          min={0}
          max={100}
          onCommit={(v) => patchField("retentionPriorWeight", v)}
        />
        <TuningNumberRow
          label="Edge Report minimum (campaigns)"
          hint="Settled campaigns a month needs before the report renders"
          value={tuning.edgeReportMinCampaigns}
          defaultValue={DEFAULT_TUNING.edgeReportMinCampaigns}
          min={1}
          max={100}
          onCommit={(v) => patchField("edgeReportMinCampaigns", v)}
        />
        <div className="mt-6 flex flex-col lg:col-span-2">
          <p className="text-sm font-medium">Effort per action (minutes)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drives the £/hr &ldquo;Rate&rdquo; sort in Do next - lower effort ranks an action
            higher per pound.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {EFFORT_ROWS.map((row) => (
              <TuningNumberRow
                key={row.kind}
                label={row.label}
                hint="Estimated minutes of hands-on effort"
                value={tuning.effortMinutes[row.kind] ?? EFFORT_MINUTES[row.kind]}
                defaultValue={EFFORT_MINUTES[row.kind]}
                min={1}
                max={480}
                onCommit={(v) => patchEffort(row.kind, v, EFFORT_MINUTES[row.kind])}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BetDefaultsCard({
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
  const defaultExchange = exchanges.find((e) => e.isDefault) ?? exchanges[0] ?? null;

  // Adjust-during-render: saved settings coming back from the server refresh
  // the text field without an effect round-trip.
  const [prevStake, setPrevStake] = useState(settings.defaultBackStake);
  if (prevStake !== settings.defaultBackStake) {
    setPrevStake(settings.defaultBackStake);
    setStake(String(settings.defaultBackStake));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4" /> Bet defaults
        </CardTitle>
        <CardDescription>
          Pre-fill Add bet when you open it from the nav. Changes save as you pick them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:max-w-xl">
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
          <Label>Default sport</Label>
          <Select
            value={settings.defaultSport}
            onValueChange={(v) => onPatch({ defaultSport: v as AppSettings["defaultSport"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <SportLabel sport={s.value} size={14} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  );
}

function AutomationCard({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" /> Automation
        </CardTitle>
        <CardDescription>Morning tasks digest, OCR matching and the mobile Home start card.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:max-w-xl">
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Daily tasks digest</p>
            <p className="text-xs text-muted-foreground">
              One morning briefing (from 09:00) of Do Next work due in the next
              3 days, inbox + push. Same-day interrupts still use Alerts.
            </p>
          </div>
          <Switch
            checked={settings.offerRemindersEnabled}
            aria-label="Daily tasks digest"
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
            aria-label="OCR auto-match events"
            onCheckedChange={(v) => onPatch({ ocrAutoMatchEvents: v })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-deck-pin">Mobile home starts on</Label>
          <Select
            value={settings.mobileDeckPin}
            onValueChange={(v) => onPatch({ mobileDeckPin: normalizeMobileDeckPin(v) })}
          >
            <SelectTrigger id="mobile-deck-pin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (context-aware)</SelectItem>
              <SelectItem value="hero">Summary</SelectItem>
              <SelectItem value="plan">Today&apos;s plan</SelectItem>
              <SelectItem value="feed">Feed</SelectItem>
              <SelectItem value="do-next">Do next</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Auto picks Summary when you have open positions (the chart lives there), Today&apos;s
            plan in the morning, otherwise Summary.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsCard({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  const { active: publicDemo } = usePublicDemo();
  const canTwoUpAlerts = canDesk(settings, "push_alerts");
  const twoUpPlansHref = publicDemo
    ? publicDemoPlansHref()
    : SETTINGS_SUBSCRIPTION_HREF;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4" /> Alerts
        </CardTitle>
        <CardDescription>
          Alerts stay until you dismiss them. Settles you confirm yourself dismiss
          automatically. While you are in Edgeways they appear in the app; the rows
          below cover banners and alerts when it is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Offer expiring with EV unclaimed</p>
            <p className="text-xs text-muted-foreground">
              An actionable offer ends today with £1+ of edge still on the table
            </p>
          </div>
          <Switch
            checked={settings.alertsOfferExpiring}
            aria-label="Alert when an offer expires with EV unclaimed"
            onCheckedChange={(v) => onPatch({ alertsOfferExpiring: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Free bet expiring</p>
            <p className="text-xs text-muted-foreground">
              A free bet with a set expiry is due within 2 hours
            </p>
          </div>
          <Switch
            checked={settings.alertsFreeBetExpiring}
            aria-label="Alert when a free bet expires"
            onCheckedChange={(v) => onPatch({ alertsFreeBetExpiring: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Race off-time approaching</p>
            <p className="text-xs text-muted-foreground">
              A tracked race goes off within 15 minutes with no bet logged
            </p>
          </div>
          <Switch
            checked={settings.alertsRaceOffSoon}
            aria-label="Alert when a race off-time approaches"
            onCheckedChange={(v) => onPatch({ alertsRaceOffSoon: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Result settled</p>
            <p className="text-xs text-muted-foreground">
              Wins as &ldquo;You just made £4.10 · Bet won&rdquo; with bookie pill above
              the title. When you settle yourself, the toast auto-dismisses. Background
              settles stay until you close them
            </p>
          </div>
          <Switch
            checked={settings.alertsResultSettled}
            aria-label="Alert when a result settles"
            onCheckedChange={(v) => onPatch({ alertsResultSettled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Unhedged back bet</p>
            <p className="text-xs text-muted-foreground">
              A qualifying or risk-free back has no lay after{" "}
              {settings.tuning.nakedExposureMinutes} minutes (
              {settings.tuning.nakedImminentMinutes} near the off)
            </p>
          </div>
          <Switch
            checked={settings.alertsNakedExposure}
            aria-label="Alert on an unhedged back bet"
            onCheckedChange={(v) => onPatch({ alertsNakedExposure: v })}
          />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
            !canTwoUpAlerts && edgePanel
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">2UP triggered</p>
            <p className="text-xs text-muted-foreground">
              {canTwoUpAlerts
                ? "Your team goes two up, early payout is in, with a lock-in suggestion"
                : FEATURE_LOCK_BODIES.push_alerts}
            </p>
          </div>
          {canTwoUpAlerts ? (
            <Switch
              checked={settings.alertsTwoUpLock}
              aria-label="Alert when a 2UP triggers"
              onCheckedChange={(v) => onPatch({ alertsTwoUpLock: v })}
            />
          ) : (
            <Button asChild {...pagePrimaryButtonProps}>
              <Link href={twoUpPlansHref}>View plans</Link>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Weekly digest</p>
            <p className="text-xs text-muted-foreground">
              Monday morning summary of last week - edge captured, leaks, offer droughts
            </p>
          </div>
          <Switch
            checked={settings.digestWeekly}
            aria-label="Send a weekly digest on Monday mornings"
            onCheckedChange={(v) => onPatch({ digestWeekly: v })}
          />
        </div>
        <NotificationPermissionButton />
        <div className="min-w-0 lg:col-span-2">
          <PushDeviceControl />
        </div>
      </CardContent>
    </Card>
  );
}

function TimeRegionCard({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <Card>
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
  );
}

function DataBackupPanel({
  onRefresh,
  hosted,
}: {
  onRefresh: () => void;
  hosted: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <p className="text-sm text-muted-foreground lg:col-span-2">
        Live racing, football and exchange feeds are held by Edgeways. This tab
        is your backup and restore.
      </p>
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
      <DataCustodyCard onRestored={onRefresh} hosted={hosted} />
      <DemoModeCard />
    </div>
  );
}

function NotificationPermissionButton() {
  const [status, setStatus] = useState<NotificationPermission | "unsupported" | "unknown">(
    "unknown"
  );

  useEffect(() => {
    // Client-only API - defer a microtask so hydration settles first.
    queueMicrotask(() => {
      setStatus(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    });
  }, []);

  const description =
    status === "denied"
      ? "Blocked for this site. In-app alerts still show. Allow notifications in the browser to change this."
      : status === "unsupported"
        ? "This browser cannot show notification banners. In-app alerts still show."
        : "Notification banners while Edgeways is open. In-app alerts still show either way.";

  const statusLabel =
    status === "granted"
      ? "On"
      : status === "denied"
        ? "Blocked"
        : status === "unsupported"
          ? "Unavailable"
          : null;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-pretty break-words">Browser notifications</p>
        <p className="text-xs text-muted-foreground text-pretty break-words">{description}</p>
      </div>
      {status === "default" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label="Allow browser notifications"
          onClick={async () => {
            const result = await Notification.requestPermission();
            setStatus(result);
          }}
        >
          Allow
        </Button>
      ) : statusLabel ? (
        <span
          className={cn(
            "shrink-0 text-xs",
            status === "denied" ? "text-warning" : "text-muted-foreground"
          )}
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
