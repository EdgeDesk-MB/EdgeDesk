"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  DESK_PREVIEW_IDS,
  DESK_PREVIEW_META,
  DESK_PREVIEW_MODE_HINT,
  DESK_PREVIEW_MODE_LABEL,
  DESK_PREVIEW_MODES,
  normalizeDeskPreviewRule,
  type DeskPreviewId,
  type DeskPreviewMode,
  type DeskPreviewSettings,
} from "@/lib/admin/desk-previews-shared";
import { filterPillGroup } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export type DeskPreviewAccount = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  owner: boolean;
  admin: boolean;
};

function accountLabel(account: DeskPreviewAccount): string {
  return account.email?.trim() || account.clerkUserId;
}

function previewModeTone(mode: DeskPreviewMode): "warning" | "edge" | undefined {
  if (mode === "off") return "warning";
  if (mode === "entitled") return "edge";
  return undefined;
}

export function DeskPreviewsPanel({
  initial,
  persisted,
  accounts,
  envLabel,
}: {
  initial: DeskPreviewSettings;
  persisted: boolean;
  accounts: DeskPreviewAccount[];
  envLabel: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [savedOnce, setSavedOnce] = useState(persisted);
  const [busyId, setBusyId] = useState<DeskPreviewId | null>(null);
  const [queryById, setQueryById] = useState<Record<DeskPreviewId, string>>({
    twoup_scout: "",
    offer_inbox: "",
  });

  const byId = useMemo(() => {
    const map = new Map(accounts.map((account) => [account.clerkUserId, account]));
    return map;
  }, [accounts]);

  function patchRule(id: DeskPreviewId, next: Partial<DeskPreviewSettings[DeskPreviewId]>) {
    setDraft((current) => ({
      ...current,
      [id]: normalizeDeskPreviewRule({ ...current[id], ...next }),
    }));
  }

  async function save(id: DeskPreviewId) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: {
            id,
            mode: draft[id].mode,
            clerkUserIds: draft[id].clerkUserIds,
          },
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        previews?: DeskPreviewSettings;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save desk previews.");
        return;
      }
      if (body.previews) {
        setSaved(body.previews);
        setDraft(body.previews);
        setSavedOnce(true);
      }
      toast.success(`${DESK_PREVIEW_META[id].title} saved on ${envLabel.toLowerCase()}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save desk previews."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desk previews</CardTitle>
        <CardDescription>
          Unfinished desk surfaces. Localhost stays on. Saves apply to{" "}
          {envLabel.toLowerCase()} only. Allowlisted people still need the plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {savedOnce ? null : (
          <p className="text-xs text-muted-foreground">
            Not saved yet. Hosted still uses the built-in owner and admin lists.
            Save a row to take control.
          </p>
        )}
        {DESK_PREVIEW_IDS.map((id) => {
          const rule = draft[id];
          const meta = DESK_PREVIEW_META[id];
          const dirty = JSON.stringify(saved[id]) !== JSON.stringify(rule);
          const selected = rule.clerkUserIds
            .map((clerkUserId) => byId.get(clerkUserId) ?? {
              clerkUserId,
              email: null,
              plan: "free",
              owner: false,
              admin: false,
            });
          const query = queryById[id].trim().toLowerCase();
          const suggestions = accounts.filter((account) => {
            if (rule.clerkUserIds.includes(account.clerkUserId)) return false;
            if (!query) return false;
            return (
              accountLabel(account).toLowerCase().includes(query) ||
              account.clerkUserId.toLowerCase().includes(query)
            );
          }).slice(0, 8);
          return (
            <div key={id} className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{meta.title}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <div
                role="group"
                aria-label={`${meta.title} mode`}
                className={cn(filterPillGroup, "min-w-0")}
              >
                {DESK_PREVIEW_MODES.map((mode) => (
                  <FilterPill
                    key={mode}
                    active={rule.mode === mode}
                    tone={previewModeTone(mode)}
                    title={
                      mode === "entitled"
                        ? meta.entitledLabel
                        : DESK_PREVIEW_MODE_HINT[mode]
                    }
                    aria-label={DESK_PREVIEW_MODE_LABEL[mode]}
                    onClick={() => patchRule(id, { mode })}
                  >
                    {mode === "entitled"
                      ? meta.entitledLabel
                      : DESK_PREVIEW_MODE_LABEL[mode]}
                  </FilterPill>
                ))}
              </div>
              {rule.mode === "allowlist" ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {selected.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nobody on the list. Hosted stays closed for this surface.
                      </p>
                    ) : (
                      selected.map((account) => (
                        <Button
                          key={account.clerkUserId}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 max-w-full gap-1 px-2 text-xs"
                          onClick={() =>
                            patchRule(id, {
                              clerkUserIds: rule.clerkUserIds.filter(
                                (value) => value !== account.clerkUserId
                              ),
                            })
                          }
                        >
                          <span className="truncate">{accountLabel(account)}</span>
                          <X className="size-3 shrink-0" aria-hidden />
                          <span className="sr-only">Remove {accountLabel(account)}</span>
                        </Button>
                      ))
                    )}
                  </div>
                  <Input
                    value={queryById[id]}
                    onChange={(event) =>
                      setQueryById((current) => ({
                        ...current,
                        [id]: event.target.value,
                      }))
                    }
                    placeholder="Add by email"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {suggestions.length > 0 ? (
                    <ul className="flex min-w-0 flex-col gap-1">
                      {suggestions.map((account) => (
                        <li key={account.clerkUserId}>
                          <button
                            type="button"
                            className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                            onClick={() => {
                              patchRule(id, {
                                clerkUserIds: [
                                  ...rule.clerkUserIds,
                                  account.clerkUserId,
                                ],
                              });
                              setQueryById((current) => ({ ...current, [id]: "" }));
                            }}
                          >
                            {accountLabel(account)}
                            <span className="text-muted-foreground">
                              {" "}
                              · {account.plan}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <Button
                type="button"
                {...pagePrimaryButtonProps}
                disabled={busyId === id || !dirty}
                onClick={() => void save(id)}
              >
                {busyId === id ? "Saving…" : `Save ${meta.title}`}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
