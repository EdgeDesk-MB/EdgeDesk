"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { api } from "@/hooks/use-app-state";
import type { AccountBalance } from "@/lib/services/balances.types";
import { formatGbp, roundMoney } from "@/lib/format-money";
import { EmptyState } from "@/components/help/empty-state";
import { Landmark } from "lucide-react";

export function TransferFundsDialog({
  open,
  onOpenChange,
  accounts,
  onSaved,
  defaultVenueId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountBalance[];
  onSaved: () => void;
  defaultVenueId?: number | null;
}) {
  const banks = useMemo(
    () => accounts.filter((a) => a.type === "bank"),
    [accounts]
  );
  const venues = useMemo(
    () => accounts.filter((a) => a.type === "bookie" || a.type === "exchange"),
    [accounts]
  );

  if (banks.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer funds</DialogTitle>
            <DialogDescription>
              Move cash from a bank to a bookie or exchange.
            </DialogDescription>
          </DialogHeader>
          <EmptyState
            compact
            oneLine
            icon={Landmark}
            title="No bank yet"
            description="Add a bank first, then move cash to bookies."
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Gate on open: the form renders DialogContent itself, so it must be
          unmounted explicitly for state to reset between opens. */}
      {open ? (
        <TransferFundsForm
          banks={banks}
          venues={venues}
          defaultVenueId={defaultVenueId}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

/**
 * Form state lives here, inside DialogContent, which Radix unmounts on close -
 * every open starts fresh from props, no reset effect needed.
 */
function TransferFundsForm({
  banks,
  venues,
  defaultVenueId,
  onOpenChange,
  onSaved,
}: {
  banks: AccountBalance[];
  venues: AccountBalance[];
  defaultVenueId?: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [bankId, setBankId] = useState<string>(() => (banks[0] ? String(banks[0].id) : ""));
  const [venueId, setVenueId] = useState<string>(() => {
    const preferred =
      (defaultVenueId != null && venues.find((v) => v.id === defaultVenueId)) ||
      venues[0];
    return preferred ? String(preferred.id) : "";
  });
  const [direction, setDirection] = useState<"to_venue" | "to_bank">("to_venue");
  const [amount, setAmount] = useState(0);
  const [fee, setFee] = useState(0);
  const [note, setNote] = useState("");
  const [pendingBankCredit, setPendingBankCredit] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!bankId || !venueId || !(amount > 0)) {
      toast.error("Pick bank, bookie/exchange, and amount");
      return;
    }
    setSaving(true);
    try {
      await api("/api/accounts/transfer", {
        method: "POST",
        json: {
          bankAccountId: Number(bankId),
          venueAccountId: Number(venueId),
          amount: roundMoney(amount),
          direction,
          fee: fee > 0 ? roundMoney(fee) : 0,
          note: note.trim() || undefined,
          pendingBankCredit: direction === "to_bank" ? pendingBankCredit : false,
        },
      });
      toast.success(
        direction === "to_venue" ? "Deposit recorded" : "Withdrawal recorded"
      );
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Transfer failed", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Transfer funds</DialogTitle>
        <DialogDescription>
          Move cash between a bank and a bookie.
        </DialogDescription>
      </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as typeof direction)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_venue">Bank → bookie / exchange (deposit)</SelectItem>
                <SelectItem value="to_bank">Bookie / exchange → bank (withdraw)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} ({formatGbp(b.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bookie / exchange</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name} ({formatGbp(v.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Amount (£)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fee (£)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={fee || ""}
                onChange={(e) => setFee(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {direction === "to_bank" ? (
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">Pending until statement</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Bank credit stays yellow until you confirm it landed
                </span>
              </span>
              <Switch checked={pendingBankCredit} onCheckedChange={setPendingBankCredit} />
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !(amount > 0)}>
            Transfer
          </Button>
        </div>
    </DialogContent>
  );
}
