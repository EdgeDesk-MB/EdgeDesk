"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SportIcon } from "@/components/sport-icon";
import {
  defaultEpLeadBy,
  epDeskSportOptions,
  epLeadUnit,
  formatEpRule,
  hasEpScope,
  removeEpScope,
  scopesForBookie,
  setEpScopeLead,
  toggleBookieKind,
  upsertEpScope,
  type EpBookieScope,
  type EpBookieSetup,
  type EpDeskSport,
} from "@/lib/twoup/bookie-offers";
import { sportDisplayLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { Check, Plus, Trash2, X } from "lucide-react";

const OTHER_SPORTS = epDeskSportOptions().filter((sport) => sport.value !== "football");
/** Left column ~2/3: at less than this "American football" (longest sport name) clips in the Select. */
const ROW_GRID = "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_2rem]";

/**
 * 2UP/1UP as a real on/off toggle, not a filter chip: the pill itself stays
 * neutral in both states (no accent-when-selected, which just borrows the
 * "active filter" look), and a red-cross / green-tick badge carries the
 * on/off signal instead - unmistakable at a glance.
 */
function EpKindToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-[6px] pl-[6px] pr-2.5 text-[11px] font-semibold leading-none",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:ring-brand/60",
        "bg-muted/60 text-foreground/75 hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-white",
          active ? "bg-profit" : "bg-negative"
        )}
      >
        {active ? (
          <Check className="size-2.5" strokeWidth={3} />
        ) : (
          <X className="size-2.5" strokeWidth={3} />
        )}
      </span>
      {label}
    </button>
  );
}

function SportLabel({ sport }: { sport: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <SportIcon sport={sport} size={12} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{sportDisplayLabel(sport)}</span>
    </span>
  );
}

function ScopeRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-start gap-2 border-b border-border/60 py-2 last:border-b-0",
        ROW_GRID
      )}
    >
      {children}
    </div>
  );
}

export function BookieEarlyPayoutRules({
  bookie,
  selection,
  onChange,
}: {
  bookie: string;
  selection: EpBookieSetup;
  onChange: (next: EpBookieSetup) => void;
}) {
  const twoOn = hasEpScope(selection, bookie, "football", 2);
  const oneOn = hasEpScope(selection, bookie, "football", 1);
  const otherScopes = scopesForBookie(selection, bookie).filter(
    (scope) => scope.sport !== "football"
  );
  const usedSports = new Set(otherScopes.map((scope) => scope.sport));
  const unusedSports = OTHER_SPORTS.filter((sport) => !usedSports.has(sport.value));

  function changeSport(scope: EpBookieScope, nextSport: EpDeskSport) {
    if (nextSport === scope.sport) return;
    onChange(
      upsertEpScope(removeEpScope(selection, scope), {
        bookie,
        sport: nextSport,
        leadBy: defaultEpLeadBy(nextSport),
      })
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col">
        <div className={cn("grid items-end gap-2 border-b border-border/60 pb-2", ROW_GRID)}>
          <p className="text-xs font-medium text-muted-foreground">Sport</p>
          <p className="text-xs font-medium text-muted-foreground">Lead</p>
          <p className="sr-only">Remove</p>
        </div>

        <ScopeRow>
          <div className="flex h-8 min-w-0 items-center">
            <SportLabel sport="football" />
          </div>
          <fieldset className="col-span-2 min-w-0 border-0 p-0">
            <legend className="sr-only">Football lead</legend>
            <div className="flex h-8 min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto">
              <EpKindToggle
                active={twoOn}
                label="2UP"
                onClick={() => onChange(toggleBookieKind(selection, bookie, "2up", !twoOn))}
              />
              <EpKindToggle
                active={oneOn}
                label="1UP"
                onClick={() => onChange(toggleBookieKind(selection, bookie, "1up", !oneOn))}
              />
            </div>
          </fieldset>
        </ScopeRow>

        {otherScopes.map((scope) => {
          const unitLabel =
            scope.leadBy === 1
              ? epLeadUnit(scope.sport).singular
              : epLeadUnit(scope.sport).plural;
          const options = [
            ...OTHER_SPORTS.filter((sport) => sport.value === scope.sport),
            ...unusedSports,
          ];
          return (
            <ScopeRow key={`${scope.sport}-${scope.leadBy}`}>
              <Select
                value={scope.sport}
                onValueChange={(value) => changeSport(scope, value as EpDeskSport)}
              >
                <SelectTrigger
                  aria-label={`${sportDisplayLabel(scope.sport)} sport`}
                  title={sportDisplayLabel(scope.sport)}
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <SportLabel sport={option.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex min-w-0 flex-col gap-1">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  aria-label={`${sportDisplayLabel(scope.sport)} lead`}
                  value={scope.leadBy}
                  onChange={(event) =>
                    onChange(setEpScopeLead(selection, scope, Number(event.target.value)))
                  }
                  className="w-full tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  {unitLabel} ahead
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-start text-muted-foreground"
                aria-label={`Remove ${sportDisplayLabel(scope.sport)} ${formatEpRule(scope.sport, scope.leadBy)}`}
                onClick={() => onChange(removeEpScope(selection, scope))}
              >
                <Trash2 className="size-4" />
              </Button>
            </ScopeRow>
          );
        })}
      </div>

      {unusedSports[0] ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange(
              upsertEpScope(selection, {
                bookie,
                sport: unusedSports[0].value,
                leadBy: defaultEpLeadBy(unusedSports[0].value),
              })
            )
          }
        >
          <Plus className="size-3.5" />
          Add row
        </Button>
      ) : null}
    </div>
  );
}
