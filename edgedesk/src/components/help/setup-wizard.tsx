"use client";

/**
 * First-run setup wizard (G2b) - bank → bookies → defaults → alerts.
 * Extends the welcome tour (its last step hands off here) rather than
 * replacing it. Everything is created in one go at Finish, so stepping
 * back and forth never double-creates accounts.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Bell, SlidersHorizontal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookieNamePicker } from "@/components/bookie-name-picker";
import { api } from "@/hooks/use-app-state";

const STEPS = [
  {
    icon: Banknote,
    title: "Your bank",
    body: "The funding source everything else draws from. The balance is what you are putting in - your bankroll.",
  },
  {
    icon: Wallet,
    title: "Your bookies",
    body: "Add the bookmakers you hold accounts with, and what is sitting in each right now. You can add more any time from Accounts.",
  },
  {
    icon: SlidersHorizontal,
    title: "Bet defaults",
    body: "Pre-fills for Add bet so logging is quick. Change them any time in Settings.",
  },
  {
    icon: Bell,
    title: "Alerts",
    body: "EdgeDesk can nudge you when an offer is about to expire unclaimed, a back sits unhedged, or a 2UP triggers.",
  },
] as const;

type BookieDraft = { name: string; balance: string };

export function SetupWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState("Bank");
  const [bankBalance, setBankBalance] = useState("");
  const [bookies, setBookies] = useState<BookieDraft[]>([{ name: "", balance: "" }]);
  const [stake, setStake] = useState("10");
  const [defaultBookie, setDefaultBookie] = useState("");
  const [notifState, setNotifState] = useState<string>("default");

  useEffect(() => {
    if (open) {
      setStep(0);
      setNotifState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    }
  }, [open]);

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function setBookie(index: number, patch: Partial<BookieDraft>) {
    setBookies((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function requestNotifications() {
    try {
      const result = await Notification.requestPermission();
      setNotifState(result);
    } catch {
      setNotifState("unsupported");
    }
  }

  async function finish() {
    setSaving(true);
    const problems: string[] = [];
    try {
      // 1. Bank (with the bankroll as its opening balance)
      let bankId: number | null = null;
      const bankAmount = parseFloat(bankBalance) || 0;
      if (bankName.trim()) {
        try {
          const res = await api<{ account: { id: number } }>("/api/accounts", {
            method: "POST",
            json: { name: bankName.trim(), type: "bank", openingBalance: bankAmount },
          });
          bankId = res.account.id;
        } catch (e) {
          problems.push(`Bank: ${String(e)}`);
        }
      }

      // 2. Bookies, funded by the bank
      let created = 0;
      for (const row of bookies) {
        const name = row.name.trim();
        if (!name) continue;
        try {
          await api("/api/accounts", {
            method: "POST",
            json: {
              name,
              type: "bookie",
              openingBalance: parseFloat(row.balance) || 0,
              fundedByAccountId: bankId,
            },
          });
          created++;
        } catch (e) {
          problems.push(`${name}: ${String(e)}`);
        }
      }

      // 3. Defaults
      const stakeValue = parseFloat(stake);
      await api("/api/settings", {
        method: "PATCH",
        json: {
          ...(Number.isFinite(stakeValue) && stakeValue > 0
            ? { defaultBackStake: stakeValue }
            : {}),
          ...(defaultBookie.trim() ? { defaultBookmaker: defaultBookie.trim() } : {}),
        },
      }).catch((e) => problems.push(`Defaults: ${String(e)}`));

      if (problems.length === 0) {
        toast.success("Your desk is set up", {
          description: `${bankId != null ? "Bank funded" : "No bank"} · ${created} bookie${created === 1 ? "" : "s"} added.`,
        });
      } else {
        toast.warning("Set up finished with issues", { description: problems[0] });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Set up your desk · Step {step + 1} of {STEPS.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setup-bank-name">Bank name</Label>
              <Input
                id="setup-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setup-bank-balance">Bankroll (£)</Label>
              <Input
                id="setup-bank-balance"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 500"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-2">
            {bookies.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem] gap-2">
                <BookieNamePicker
                  label=""
                  value={row.name}
                  onChange={(v) => setBookie(i, { name: v })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Balance £"
                  aria-label={`Balance for bookie ${i + 1}`}
                  value={row.balance}
                  onChange={(e) => setBookie(i, { balance: e.target.value })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setBookies((rows) => [...rows, { name: "", balance: "" }])}
            >
              Add another bookie
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setup-stake">Default back stake (£)</Label>
              <Input
                id="setup-stake"
                type="number"
                min={0}
                step="0.01"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Default bookie</Label>
              <BookieNamePicker label="" value={defaultBookie} onChange={setDefaultBookie} />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-2">
            {notifState === "granted" ? (
              <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                Notifications are enabled on this device.
              </p>
            ) : notifState === "unsupported" ? (
              <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                This browser cannot show notifications here - alerts will arrive as in-app
                toasts. See Help → On your phone for the mobile setup.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => void requestNotifications()}
              >
                Enable notifications
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              For alerts on your phone with the app closed, see Settings → Alerts → Push to
              this device. Bet history in a spreadsheet? Import it any time from Settings →
              Data &amp; API.
            </p>
          </div>
        ) : null}

        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`size-1.5 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" disabled={saving} onClick={() => void finish()}>
                {saving ? "Setting up…" : "Finish set-up"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
