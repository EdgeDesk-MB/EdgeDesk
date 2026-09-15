"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSaveButton } from "@/components/ui/dialog-save-button";
import { Button } from "@/components/ui/button";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookieColourDot } from "@/components/calc/bookie-chip";
import { EmptyState } from "@/components/help/empty-state";
import { BookieEarlyPayoutRules } from "@/components/bets/bookie-early-payout-rules";
import { FormSection } from "@/components/ui/form-section";
import { Label } from "@/components/ui/label";
import { accountsScopeHref, venueIdForBookie } from "@/lib/accounts/bookie-scope-href";
import {
  earlyPayoutBookieNames,
  formatEpScopeChip,
  scopesForBookie,
  type EpBookieSetup,
} from "@/lib/twoup/bookie-offers";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";
import { Bookmark, Timer, Wallet } from "lucide-react";

export function TwoUpBookieDialog({
  open,
  onOpenChange,
  wallets,
  walletAccounts = [],
  walletsLoaded = true,
  selection,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: string[];
  walletAccounts?: readonly { id: number; name: string }[];
  walletsLoaded?: boolean;
  selection: EpBookieSetup;
  onChange: (next: EpBookieSetup) => void;
}) {
  const bookieFieldId = useId();
  const scopedNames = useMemo(() => earlyPayoutBookieNames(selection), [selection]);
  const [selected, setSelected] = useState<string | null>(null);
  const [earlyOpen, setEarlyOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    setEarlyOpen(true);
    setSelected((current) => {
      if (current && (scopedNames.includes(current) || wallets.includes(current))) {
        return current;
      }
      return scopedNames[0] ?? wallets[0] ?? null;
    });
  }, [open, scopedNames, wallets]);

  const addable = wallets.filter(
    (name) => !scopedNames.some((scoped) => scoped.toLowerCase() === name.toLowerCase())
  );
  const venueId = selected ? venueIdForBookie(walletAccounts, selected) : null;
  const summary = selected ? scopesForBookie(selection, selected) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,90vh)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <Bookmark className={dialogTitleIcon} />
            Scope
          </DialogTitle>
          <DialogDescription
            explainer={
              <DialogExplainer title="Early-payout scope">
                Pick one bookie, then set the sports and lead that pay. All
                surfaces live on Accounts → Scope. This is not a live offer
                list.
              </DialogExplainer>
            }
          >
            Early-payout rules for one bookie.
          </DialogDescription>
        </DialogHeader>
        <ScrollFadeEdges
          className="min-h-0 flex-1"
          fadeClassName="from-page dark:from-card"
          scrollClassName="app-scroll-nested space-y-2.5 px-6 py-5"
        >
          {!walletsLoaded ? (
            <EmptyState
              compact
              busy
              icon={Wallet}
              title="Loading bookies"
              description="Reading the wallets on Accounts."
            />
          ) : wallets.length === 0 ? (
            <EmptyState
              compact
              icon={Wallet}
              title="No bookie wallets yet"
              description="Add a bookie on Accounts, then set Scope there."
              action={{ label: "Open Accounts", href: "/accounts" }}
            />
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor={bookieFieldId} className="text-xs text-muted-foreground">
                  Bookie
                </Label>
                <div className="flex min-w-0 items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={selected ?? ""}
                      onValueChange={(name) => setSelected(name)}
                    >
                      <SelectTrigger
                        id={bookieFieldId}
                        aria-label="Bookie"
                        title={selected ?? undefined}
                        className="w-full"
                      >
                        <SelectValue placeholder="Pick a bookie" />
                      </SelectTrigger>
                      <SelectContent>
                        {scopedNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            <span className="inline-flex items-center gap-1.5">
                              <BookieColourDot name={name} size="md" />
                              {name}
                            </span>
                          </SelectItem>
                        ))}
                        {addable
                          .filter((name) => !scopedNames.includes(name))
                          .map((name) => (
                            <SelectItem key={`add-${name}`} value={name}>
                              <span className="inline-flex items-center gap-1.5">
                                <BookieColourDot name={name} size="md" />
                                {name}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {venueId != null ? (
                    <Button variant="ghost" size="sm" className="shrink-0 text-xs" asChild>
                      <Link href={accountsScopeHref(venueId)} onClick={() => onOpenChange(false)}>
                        Accounts
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {addable.length > 0 && scopedNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Pick a bookie to write the first early-payout rule.
                  </p>
                ) : null}
              </div>

              {selected ? (
                <FormSection
                  title="Early payout"
                  icon={<Timer className="size-3.5" />}
                  open={earlyOpen}
                  onOpenChange={setEarlyOpen}
                  summary={
                    summary.length > 0
                      ? summary.map(formatEpScopeChip).join(", ")
                      : "No rules yet"
                  }
                >
                  <BookieEarlyPayoutRules
                    bookie={selected}
                    selection={selection}
                    onChange={onChange}
                  />
                </FormSection>
              ) : null}
            </>
          )}
        </ScrollFadeEdges>
        <DialogFooter className="mx-0 mb-0 shrink-0 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DialogSaveButton onClick={() => onOpenChange(false)}>Done</DialogSaveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
