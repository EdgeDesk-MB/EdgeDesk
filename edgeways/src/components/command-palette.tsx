"use client";

/**
 * Command palette (F4) - Cmd/Ctrl+K. Searches live app state only (pages,
 * quick actions, offers, bookies) so there is no separate index to go stale.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Gift, Plus, Wallet, Zap } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PlanNavMark, flatNavLinks } from "@/components/app-nav";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { useBoostCheck } from "@/components/boosts/boost-check-provider";
import { useAppState } from "@/hooks/use-app-state";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state } = useAppState();
  const { openAddBet } = useAddBet();
  const { openAddBalance } = useAddBalance();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer, viewOffer } = useOfferDialog();
  const { openCasinoLog } = useCasinoLog();
  const { openBoostCheck } = useBoostCheck();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  // Live entities only: open/planned offers and active bookie wallets.
  const offers = useMemo(
    () =>
      (state?.offers ?? [])
        .filter((o) => o.status === "active" || o.status === "planned")
        .slice(0, 30),
    [state?.offers]
  );
  const bookies = useMemo(
    () =>
      (state?.balances?.accounts ?? []).filter((a) => a.type === "bookie" && a.isActive === 1),
    [state?.balances?.accounts]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
      <CommandInput placeholder="Jump to a page, offer or bookie…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => openAddBet())}>
            <Plus /> Add bet
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                if (!canDesk(state?.settings, "offers_pipeline")) {
                  router.push("/offers");
                  return;
                }
                openOffer();
              })
            }
          >
            <Gift /> New offer
          </CommandItem>
          <CommandItem onSelect={() => run(() => openMatchedCalculator())}>
            <Plus /> Matched calculator
          </CommandItem>
          <CommandItem onSelect={() => run(() => openAddBalance())}>
            <Wallet /> Adjust balance
          </CommandItem>
          <CommandItem onSelect={() => run(openCasinoLog)}>
            <Dices /> Log casino offer
          </CommandItem>
          <CommandItem onSelect={() => run(openBoostCheck)}>
            <Zap /> Check a boost
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Pages">
          {flatNavLinks.map((link) => {
            const locked = Boolean(
              link.feature && !canDesk(state?.settings, link.feature)
            );
            return (
              <CommandItem
                key={link.href}
                value={`page ${link.label}`}
                onSelect={() =>
                  run(() => {
                    router.push(link.href);
                  })
                }
              >
                <link.icon />
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{link.label}</span>
                  {link.feature && !link.isSubNav ? (
                    <PlanNavMark feature={link.feature} locked={locked} />
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {offers.length > 0 ? (
          <CommandGroup heading="Offers">
            {offers.map((offer) => (
              <CommandItem
                key={offer.id}
                value={`offer ${offer.title} ${offer.bookmaker ?? ""}`}
                onSelect={() =>
                  run(() => {
                    if (!canDesk(state?.settings, "offers_pipeline")) {
                      router.push("/offers");
                      return;
                    }
                    viewOffer(offer);
                  })
                }
              >
                <Gift />
                <span className="truncate">{offer.title}</span>
                {offer.bookmaker ? (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {offer.bookmaker}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {bookies.length > 0 ? (
          <CommandGroup heading="Bookies">
            {bookies.map((account) => (
              <CommandItem
                key={account.id}
                value={`bookie ${account.name}`}
                onSelect={() => run(() => router.push("/accounts"))}
              >
                <Wallet />
                <span className="truncate">{account.name}</span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                  £{(account.balance ?? 0).toFixed(2)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
