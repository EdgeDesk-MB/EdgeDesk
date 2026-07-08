"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookieNamePicker } from "@/components/bookie-name-picker";
import { Switch } from "@/components/ui/switch";
import { MoneyFlow } from "@/components/money-flow";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import type { AppSettings } from "@/lib/services/settings";
import type { AccountBalance } from "@/lib/services/balances";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { bookieBrandColor } from "@/lib/brands/bookies";
import type { ExchangeRow } from "@/lib/db/schema";
import type { ExchangeProviderStatus } from "@/lib/services/exchange/types";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { useOnboarding } from "@/components/help/onboarding-provider";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/app-version";
import { Plus, Trash2, Download, Bell, SlidersHorizontal, BookOpen, Map, RotateCcw } from "lucide-react";

export default function SettingsPage() {
  const { resetAndOpenWelcome } = useOnboarding();
  const { exchanges, refresh: refreshExchanges } = useExchanges();
  const { state, refresh } = useAppState(5000);
  const settings = state?.settings;
  const [bookies, setBookies] = useState<AccountBalance[]>([]);
  const [accountsTab, setAccountsTab] = useState<"exchanges" | "bookies">("exchanges");
  const [prefsTab, setPrefsTab] = useState<"accounts" | "preferences" | "data">("accounts");

  const loadBookies = useCallback(async () => {
    try {
      const res = await api<{ bookies: AccountBalance[] }>("/api/bookies");
      setBookies(res.bookies);
    } catch (e) {
      toast.error("Could not load bookies", { description: String(e) });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadBookies);
  }, [loadBookies]);

  async function patchExchange(id: number, json: Record<string, unknown>, message?: string) {
    try {
      await api(`/api/exchanges/${id}`, { method: "PATCH", json });
      if (message) toast.success(message);
      refreshExchanges();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  async function deleteExchange(id: number) {
    try {
      await api(`/api/exchanges/${id}`, { method: "DELETE" });
      toast.success("Exchange removed");
      refreshExchanges();
    } catch (e) {
      toast.error("Delete failed", { description: String(e) });
    }
  }

  async function patchBookie(id: number, brandColor: string) {
    try {
      await api(`/api/accounts/${id}`, { method: "PATCH", json: { brandColor } });
      loadBookies();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  async function archiveBookie(id: number) {
    try {
      await api(`/api/accounts/${id}`, { method: "DELETE" });
      toast.success("Bookie archived");
      loadBookies();
    } catch (e) {
      toast.error("Delete failed", { description: String(e) });
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
        description="Accounts, defaults, reminders and data — everything that shapes how EdgeDesk behaves."
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

      <Tabs value={prefsTab} onValueChange={(v) => setPrefsTab(v as typeof prefsTab)}>
        <TabsList variant="segmented">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="data">Data &amp; API</TabsTrigger>
        </TabsList>
      </Tabs>

      {prefsTab === "preferences" && settings && (
        <PreferencesPanel settings={settings} onPatch={patchSettings} />
      )}

      {prefsTab === "data" && (
        <DataApiPanel
          apiConfigured={state?.apiConfigured}
          racingApiConfigured={state?.racingApiConfigured}
          exchangeName={state?.exchangeName}
          exchangeStatus={state?.exchangeStatus}
          exchangeProviders={state?.exchangeProviders}
        />
      )}

      {prefsTab === "accounts" && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle section>My accounts</CardTitle>
          <CardDescription>
            Exchanges power calculator lay panels. Bookies listed here are wallets with a balance
            or ledger history — set a brand colour for each.
          </CardDescription>
          <Tabs
            value={accountsTab}
            onValueChange={(v) => setAccountsTab(v as typeof accountsTab)}
            className="mt-3"
          >
            <TabsList variant="segmented">
              <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
              <TabsTrigger value="bookies">Bookies</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {accountsTab === "exchanges" ? (
            <>
              <div className="mb-3 flex justify-end">
                <AddExchangeDialog onSaved={refreshExchanges} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exchange</TableHead>
                    <TableHead className="w-40">Commission %</TableHead>
                    <TableHead>Colours</TableHead>
                    <TableHead className="w-28">Default</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchanges.map((exchange) => (
                    <ExchangeEditRow
                      key={exchange.id}
                      exchange={exchange}
                      onPatch={patchExchange}
                      onDelete={deleteExchange}
                    />
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <AddBookieDialog onSaved={loadBookies} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bookie</TableHead>
                    <TableHead className="w-36">Brand colour</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No bookie wallets yet — add one here or via Add balance when topping up.
                      </TableCell>
                    </TableRow>
                  )}
                  {bookies.map((bookie) => (
                    <BookieEditRow
                      key={bookie.id}
                      bookie={bookie}
                      onPatchColor={patchBookie}
                      onArchive={archiveBookie}
                    />
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
      )}

    </PageShell>
  );
}

function PreferencesPanel({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  const [stake, setStake] = useState(String(settings.defaultBackStake));
  const [bookmaker, setBookmaker] = useState(settings.defaultBookmaker);
  const [pollMs, setPollMs] = useState(String(settings.dashboardPollMs));

  useEffect(() => {
    setStake(String(settings.defaultBackStake));
    setBookmaker(settings.defaultBookmaker);
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
            Pre-fill Add bet when you open it from the nav. Default exchange is set on the Accounts
            tab.
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
            <Label>Default bookmaker</Label>
            <BookieNamePicker value={bookmaker} onChange={setBookmaker} />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onPatch({ defaultBookmaker: bookmaker.trim() })}
            >
              Save bookmaker default
            </Button>
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
    </div>
  );
}

function DataApiPanel({
  apiConfigured,
  racingApiConfigured,
  exchangeName,
  exchangeStatus,
  exchangeProviders,
}: {
  apiConfigured?: boolean;
  racingApiConfigured?: boolean;
  exchangeName?: string;
  exchangeStatus?: ExchangeProviderStatus;
  exchangeProviders?: ExchangeProviderStatus[];
}) {
  const [testingExchange, setTestingExchange] = useState(false);

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
              ["settlements", "Settlements"],
              ["balances", "Balances"],
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
          <CardDescription>Set in <code className="text-xs">.env.local</code> — restart the dev server after changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span>API-Football</span>
            <Badge variant={apiConfigured ? "default" : "outline"}>
              {apiConfigured ? "Configured" : "Demo mode"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span>The Racing API</span>
            <Badge variant={racingApiConfigured ? "default" : "outline"}>
              {racingApiConfigured ? "Configured" : "Not set"}
            </Badge>
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
            <strong>Betfair:</strong> free delayed app key at developer.betfair.com — set{" "}
            <code className="rounded bg-muted px-1">BETFAIR_APP_KEY</code>,{" "}
            <code className="rounded bg-muted px-1">BETFAIR_USERNAME</code>,{" "}
            <code className="rounded bg-muted px-1">BETFAIR_PASSWORD</code>.{" "}
            <strong>Betdaq:</strong> partner API only — placeholder until credentials available.
            Racing Basic tier unlocks automatic result sync.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BookieEditRow({
  bookie,
  onPatchColor,
  onArchive,
}: {
  bookie: AccountBalance;
  onPatchColor: (id: number, color: string) => void;
  onArchive: (id: number) => void;
}) {
  const displayColor = bookieBrandColor(bookie.name, bookie.brandColor);
  const [color, setColor] = useState(displayColor);

  useEffect(() => {
    setColor(bookieBrandColor(bookie.name, bookie.brandColor));
  }, [bookie.id, bookie.brandColor, bookie.name]);

  return (
    <TableRow className={bookie.isActive ? undefined : "opacity-60"}>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <span
            className="inline-block size-3 shrink-0 rounded-full"
            style={{ backgroundColor: displayColor }}
          />
          {bookie.name}
          {!bookie.isActive && (
            <Badge variant="outline" className="text-[10px] font-normal">
              archived
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => {
            if (color !== (bookie.brandColor ?? displayColor)) {
              onPatchColor(bookie.id, color);
            }
          }}
          className="h-9 w-full max-w-[120px] cursor-pointer rounded-md border bg-transparent"
        />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        <MoneyFlow value={bookie.balance} />
      </TableCell>
      <TableCell>
        {bookie.isActive ? (
          <Button variant="ghost" size="icon" onClick={() => onArchive(bookie.id)}>
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function AddBookieDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#3f3f46");

  useEffect(() => {
    if (name.trim()) setBrandColor(bookieBrandColor(name.trim()));
  }, [name]);

  async function save() {
    if (!name.trim()) {
      toast.error("Enter a bookie name");
      return;
    }
    try {
      await api("/api/bookies", {
        method: "POST",
        json: { name: name.trim(), brandColor },
      });
      toast.success(`${name.trim()} added`);
      setOpen(false);
      setName("");
      onSaved();
    } catch (e) {
      toast.error("Could not add bookie", { description: String(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add bookie
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add bookie</DialogTitle>
          <DialogDescription>
            Pick from the list or enter a custom name. Brand colour defaults to the known palette.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <BookieNamePicker value={name} onChange={setName} />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Brand colour</Label>
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border bg-transparent"
            />
          </div>
          <Button onClick={save}>Add bookie</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExchangeEditRow({
  exchange,
  onPatch,
  onDelete,
}: {
  exchange: ExchangeRow;
  onPatch: (id: number, json: Record<string, unknown>, message?: string) => void;
  onDelete: (id: number) => void;
}) {
  const [commission, setCommission] = useState(String(exchange.commissionPct));

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <span
            className="inline-block size-3 rounded-full"
            style={{ backgroundColor: exchange.brandColor }}
          />
          {exchange.name}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={0.5}
            min={0}
            max={20}
            className="h-8 w-20 tabular-nums"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            onBlur={() => {
              const v = parseFloat(commission);
              if (Number.isFinite(v) && v !== exchange.commissionPct) {
                onPatch(exchange.id, { commissionPct: v }, `${exchange.name} set to ${v}%`);
              }
            }}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-medium text-black/70"
            style={{ backgroundColor: exchange.backColor }}
          >
            back
          </span>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-medium text-black/70"
            style={{ backgroundColor: exchange.layColor }}
          >
            lay
          </span>
        </div>
      </TableCell>
      <TableCell>
        {exchange.isDefault ? (
          <Badge>default</Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onPatch(exchange.id, { isDefault: true }, `${exchange.name} is now default`)}
          >
            Make default
          </Button>
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => onDelete(exchange.id)}>
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddExchangeDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("custom");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState(0);
  const [brandColor, setBrandColor] = useState("#3f3f46");
  const [backColor, setBackColor] = useState("#a6d8ff");
  const [layColor, setLayColor] = useState("#fac9d1");

  function applyPreset(value: string) {
    setPreset(value);
    const p = EXCHANGE_PRESETS.find((x) => x.name === value);
    if (p) {
      setName(p.name);
      setCommission(p.commissionPct);
      setBrandColor(p.brandColor);
      setBackColor(p.backColor);
      setLayColor(p.layColor);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Give the exchange a name");
      return;
    }
    try {
      await api("/api/exchanges", {
        method: "POST",
        json: { name, commissionPct: commission, brandColor, backColor, layColor },
      });
      toast.success(`${name} added`);
      setOpen(false);
      setName("");
      setPreset("custom");
      onSaved();
    } catch (e) {
      toast.error("Could not add exchange", { description: String(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add exchange
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add exchange</DialogTitle>
          <DialogDescription>
            Pick a preset (colours included) and set the commission you actually pay.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Preset</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom…</SelectItem>
                {EXCHANGE_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Betdaq" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Commission %</Label>
            <Input
              type="number"
              step={0.5}
              min={0}
              max={20}
              className="tabular-nums"
              value={commission}
              onChange={(e) => setCommission(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Brand", brandColor, setBrandColor],
                ["Back", backColor, setBackColor],
                ["Lay", layColor, setLayColor],
              ] as const
            ).map(([label, value, set]) => (
              <div key={label} className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border bg-transparent"
                />
              </div>
            ))}
          </div>
          <Button onClick={save}>Add exchange</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
