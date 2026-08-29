"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/help/empty-state";
import { MaintenanceBannerView } from "@/components/admin/maintenance-banner";
import { FilterPill } from "@/components/ui/filter-pill";
import type { FlagsOverview } from "@/lib/admin/flags";
import {
  DEFAULT_BANNER_LINK_LABEL,
  DEFAULT_BANNER_MESSAGE,
  MAX_BANNER_HREF_LENGTH,
  MAX_BANNER_LINK_LABEL_LENGTH,
  MAX_BANNER_MESSAGE_LENGTH,
  SITE_BANNER_KIND_HINT,
  SITE_BANNER_KIND_LABEL,
  SITE_BANNER_KINDS,
  isInvalidBannerHrefInput,
  normalizeBannerHref,
  siteBannerSwatchClass,
  type MaintenanceBanner,
  type SiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";
import { filterPillGroup } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function bannerKindPillTone(
  kind: SiteBannerKind
): "warning" | "ink" | "edge" {
  if (kind === "offer") return "edge";
  if (kind === "notice") return "ink";
  return "warning";
}

export function ReleasesPanel({
  flags,
  banner,
}: {
  flags: FlagsOverview;
  banner: MaintenanceBanner;
}) {
  const [saved, setSaved] = useState(banner);
  const [enabled, setEnabled] = useState(banner.enabled);
  const [message, setMessage] = useState(banner.message);
  const [kind, setKind] = useState<SiteBannerKind>(banner.kind);
  const [href, setHref] = useState(banner.href ?? "");
  const [linkLabel, setLinkLabel] = useState(banner.linkLabel ?? "");
  const [saving, setSaving] = useState(false);
  const [flagBusy, setFlagBusy] = useState<number | null>(null);
  const [flagRows, setFlagRows] = useState(flags.flags);

  const hrefError = isInvalidBannerHrefInput(href)
    ? "Enter a valid http(s) link, or a path starting with /, or clear the field."
    : null;
  const previewMessage = message.trim() || DEFAULT_BANNER_MESSAGE[kind];
  const dirty =
    enabled !== saved.enabled ||
    message !== saved.message ||
    kind !== saved.kind ||
    href !== (saved.href ?? "") ||
    linkLabel !== (saved.linkLabel ?? "");

  function selectKind(option: SiteBannerKind) {
    setKind(option);
    const current = message.trim();
    const isStock = (Object.values(DEFAULT_BANNER_MESSAGE) as string[]).includes(
      current
    );
    if (!current || isStock) {
      setMessage(DEFAULT_BANNER_MESSAGE[option]);
    }
  }

  async function saveBanner() {
    if (hrefError) {
      toast.error(hrefError);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banner: {
            enabled,
            message,
            kind,
            href,
            linkLabel,
          },
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        banner?: MaintenanceBanner;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save the banner.");
        return;
      }
      if (body.banner) {
        setSaved(body.banner);
        setEnabled(body.banner.enabled);
        setMessage(body.banner.message);
        setKind(body.banner.kind);
        setHref(body.banner.href ?? "");
        setLinkLabel(body.banner.linkLabel ?? "");
      }
      toast.success(enabled ? "Banner is on." : "Banner is off.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the banner.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(id: number, active: boolean) {
    setFlagBusy(id);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: { id, active } }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not update the flag.");
        return;
      }
      setFlagRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, active } : row))
      );
      toast.success(body.message ?? "Flag updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the flag.");
    } finally {
      setFlagBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site banner</CardTitle>
          <CardDescription>
            Shows on the desk for every signed-in account. Type sets the colour.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="maintenance-enabled">Show banner</Label>
            <Switch
              id="maintenance-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium leading-none">
              Type
            </legend>
            <div
              role="group"
              aria-label="Banner type"
              className={cn(filterPillGroup, "min-w-0")}
            >
              {SITE_BANNER_KINDS.map((option) => {
                const active = kind === option;
                return (
                  <FilterPill
                    key={option}
                    active={active}
                    tone={bannerKindPillTone(option)}
                    title={SITE_BANNER_KIND_HINT[option]}
                    aria-label={SITE_BANNER_KIND_LABEL[option]}
                    onClick={() => selectKind(option)}
                  >
                    <span
                      className={cn(
                        "size-3 shrink-0 rounded-full",
                        active ? "bg-current" : siteBannerSwatchClass(option)
                      )}
                      aria-hidden
                    />
                    {SITE_BANNER_KIND_LABEL[option]}
                  </FilterPill>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {SITE_BANNER_KIND_HINT[kind]}. Amber, ink, or Edge violet.
            </p>
          </fieldset>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="maintenance-message">Message</Label>
            <Input
              id="maintenance-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_BANNER_MESSAGE_LENGTH}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="maintenance-href">Link (optional)</Label>
            <Input
              id="maintenance-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              maxLength={MAX_BANNER_HREF_LENGTH}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://… or /offers"
              aria-invalid={Boolean(hrefError)}
              aria-describedby={hrefError ? "maintenance-href-error" : "maintenance-href-hint"}
            />
            {hrefError ? (
              <p id="maintenance-href-error" className="text-xs text-destructive">
                {hrefError}
              </p>
            ) : (
              <p id="maintenance-href-hint" className="text-xs text-muted-foreground">
                Status page, offer URL, or an in-app path.
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="maintenance-link-label">Link label (optional)</Label>
            <Input
              id="maintenance-link-label"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              maxLength={MAX_BANNER_LINK_LABEL_LENGTH}
              placeholder={DEFAULT_BANNER_LINK_LABEL}
              disabled={!href.trim()}
            />
          </div>
          <Button type="button" {...pagePrimaryButtonProps} disabled={saving} onClick={() => void saveBanner()}>
            {saving ? "Saving…" : "Save banner"}
          </Button>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <div inert className="min-w-0 overflow-hidden rounded-lg">
              <MaintenanceBannerView
                message={previewMessage}
                kind={kind}
                href={hrefError ? null : normalizeBannerHref(href)}
                linkLabel={linkLabel.trim() || null}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {!enabled
                ? "Turn Show banner on and save to publish."
                : dirty
                  ? "Unsaved. Save to publish."
                  : "Live on the desk."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release flags</CardTitle>
          <CardDescription>
            PostHog flags for staged rollouts. Deploys stay on Vercel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {flags.message ? (
            <p className="text-sm text-muted-foreground">{flags.message}</p>
          ) : null}
          {flagRows.length === 0 ? (
            <EmptyState
              compact
              icon={Flag}
              title="No flags loaded"
              description="Connect PostHog, or open the project to add a flag."
            />
          ) : (
            flagRows.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{flag.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {flag.key}
                    {flag.rollout != null ? (
                      <span className="ml-1.5 font-semibold text-warning">
                        {flag.rollout}% rollout
                      </span>
                    ) : null}
                  </p>
                </div>
                <Switch
                  checked={flag.active}
                  disabled={flagBusy === flag.id}
                  onCheckedChange={(active) => void toggleFlag(flag.id, active)}
                />
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={flags.projectUrl} target="_blank" rel="noreferrer">
                Open PostHog
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={flags.vercelUrl} target="_blank" rel="noreferrer">
                Open Vercel
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={flags.currentDeployUrl} target="_blank" rel="noreferrer">
                Open this deploy
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
