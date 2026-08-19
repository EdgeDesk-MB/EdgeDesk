"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { bookieBrandColor } from "@/lib/brands/bookies";
import type { AccountBalance } from "@/lib/services/balances.types";
import type { ExchangeRow } from "@/lib/db/schema";
import { Landmark, Plus, Trash2, Wallet } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";

type BookieAccessStatus = "available" | "gubbed" | "closed";

function bookieAccessLabel(status: BookieAccessStatus | string | null | undefined): string {
  if (status === "gubbed") return "Gubbed";
  if (status === "closed") return "Closed";
  return "Available";
}

export function ManageVenuesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { exchanges, refresh: refreshExchanges } = useExchanges();
  const [bookies, setBookies] = useState<AccountBalance[]>([]);
  const [accountsTab, setAccountsTab] = useState<"exchanges" | "bookies">("exchanges");

  const loadBookies = useCallback(async () => {
    try {
      const res = await api<{ bookies: AccountBalance[] }>("/api/bookies");
      setBookies(res.bookies);
    } catch (e) {
      toast.error("Could not load bookies", { description: String(e) });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(loadBookies);
    refreshExchanges();
  }, [open, loadBookies, refreshExchanges]);

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

  async function patchBookie(id: number, json: Record<string, unknown>, message?: string) {
    try {
      await api(`/api/accounts/${id}`, { method: "PATCH", json });
      if (message) toast.success(message);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="mx-0 mt-0">
          <DialogTitle>Manage venues</DialogTitle>
          <DialogDescription>
            Set colours, commission, and bookie status.
          </DialogDescription>
        </DialogHeader>
        <div className="app-scroll-nested flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          <Tabs
            value={accountsTab}
            onValueChange={(v) => setAccountsTab(v as typeof accountsTab)}
            activationMode="manual"
          >
            <TabsList variant="segmented">
              <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
              <TabsTrigger value="bookies">Bookies</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-4">
            {accountsTab === "exchanges" ? (
              exchanges.length === 0 ? (
                <EmptyState
                  compact
                  oneLine
                  icon={Landmark}
                  title="No exchanges yet"
                  description="Add an exchange so lays have a default venue."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exchange</TableHead>
                      <TableHead className="w-40">Commission %</TableHead>
                      <TableHead>Colours</TableHead>
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
              )
            ) : bookies.length === 0 ? (
              <EmptyState
                compact
                oneLine
                icon={Wallet}
                title="No bookie wallets yet"
                description="Add one here, or via Adjust balance."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bookie</TableHead>
                    <TableHead className="w-28">Owner</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28">Colour</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookies.map((bookie) => (
                    <BookieEditRow
                      key={bookie.id}
                      bookie={bookie}
                      onPatch={patchBookie}
                      onArchive={archiveBookie}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t">
          <div className="flex justify-end gap-2 px-6 py-4">
            {accountsTab === "exchanges" ? (
              <AddExchangeDialog onSaved={refreshExchanges} />
            ) : (
              <AddBookieDialog onSaved={loadBookies} />
            )}
          </div>
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
            className="rounded px-2 py-0.5 text-[11px] font-medium text-black/70"
            style={{ backgroundColor: exchange.backColor }}
          >
            back
          </span>
          <span
            className="rounded px-2 py-0.5 text-[11px] font-medium text-black/70"
            style={{ backgroundColor: exchange.layColor }}
          >
            lay
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => onDelete(exchange.id)}>
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function BookieEditRow({
  bookie,
  onPatch,
  onArchive,
}: {
  bookie: AccountBalance;
  onPatch: (id: number, json: Record<string, unknown>, message?: string) => void;
  onArchive: (id: number) => void;
}) {
  const displayColor = bookieBrandColor(bookie.name, bookie.brandColor);
  const [color, setColor] = useState(displayColor);
  const [notes, setNotes] = useState(bookie.notes ?? "");
  const accessStatus = (bookie.accessStatus ?? "available") as BookieAccessStatus;

  // Adjust-during-render: external edits to the row refresh the form fields.
  const [prevBookie, setPrevBookie] = useState({
    id: bookie.id,
    brandColor: bookie.brandColor,
    name: bookie.name,
    notes: bookie.notes,
  });
  if (
    prevBookie.id !== bookie.id ||
    prevBookie.brandColor !== bookie.brandColor ||
    prevBookie.name !== bookie.name ||
    prevBookie.notes !== bookie.notes
  ) {
    setPrevBookie({ id: bookie.id, brandColor: bookie.brandColor, name: bookie.name, notes: bookie.notes });
    setColor(bookieBrandColor(bookie.name, bookie.brandColor));
    setNotes(bookie.notes ?? "");
  }

  return (
    <>
      <TableRow className={bookie.isActive ? undefined : "opacity-60"}>
        <TableCell>
          <span className="flex items-center gap-2 font-medium">
            <span
              className="inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: displayColor }}
            />
            {bookie.name}
            {!bookie.isActive && (
              <Badge variant="outline" className="text-[11px] font-normal">
                archived
              </Badge>
            )}
          </span>
        </TableCell>
        <TableCell>
          <Input
            defaultValue={bookie.owner ?? "me"}
            key={`owner-${bookie.id}-${bookie.owner ?? "me"}`}
            className="h-8 text-xs"
            aria-label={`Owner of ${bookie.name}`}
            onBlur={(e) => {
              const next = e.target.value.trim() || "me";
              if (next !== (bookie.owner ?? "me")) {
                onPatch(bookie.id, { owner: next }, `${bookie.name} → operated by ${next}`);
              }
            }}
          />
        </TableCell>
        <TableCell>
          <Select
            value={accessStatus}
            onValueChange={(v) => {
              const next = v as BookieAccessStatus;
              onPatch(bookie.id, { accessStatus: next }, `${bookie.name} → ${bookieAccessLabel(next)}`);
            }}
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="gubbed">Gubbed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            onBlur={() => {
              if (color !== (bookie.brandColor ?? displayColor)) {
                onPatch(bookie.id, { brandColor: color });
              }
            }}
            className="h-8 w-full max-w-[96px] cursor-pointer rounded-md border bg-transparent"
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
      <TableRow className={bookie.isActive ? "border-b" : "border-b opacity-60"}>
        <TableCell colSpan={6} className="pt-0 pb-3">
          <Input
            value={notes}
            placeholder="Notes - limits, gub details, login tips…"
            className="h-8 text-xs"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              const next = notes.trim() || null;
              const prev = bookie.notes?.trim() || null;
              if (next !== prev) {
                onPatch(bookie.id, { notes: next });
              }
            }}
          />
        </TableCell>
      </TableRow>
    </>
  );
}

function AddBookieDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#3f3f46");

  /** Typing a known bookie name adopts its brand colour immediately. */
  function changeName(next: string) {
    setName(next);
    if (next.trim()) setBrandColor(bookieBrandColor(next.trim()));
  }

  function resetForm() {
    setName("");
    setBrandColor("#3f3f46");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Enter a bookie name");
      return;
    }
    try {
      const res = await api<{ bookie: { name: string }; created?: boolean }>("/api/bookies", {
        method: "POST",
        json: { name: name.trim(), brandColor },
      });
      toast.success(
        res.created === false
          ? `${name.trim()} already on your list, brand colour updated`
          : `${name.trim()} added`
      );
      setOpen(false);
      resetForm();
      onSaved();
    } catch (e) {
      toast.error("Could not add bookie", { description: String(e) });
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add bookie
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add bookie</DialogTitle>
            <DialogDescription>
              Pick a bookie or type a custom name.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <BookieNamePicker
              value={name}
              onChange={changeName}
              persistCustom={false}
              brandColor={brandColor}
              omitExistingWallets
            />
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
    </>
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
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add exchange
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add exchange</DialogTitle>
            <DialogDescription>
              Pick a preset and set the commission you pay.
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Betdaq"
              />
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
    </>
  );
}
