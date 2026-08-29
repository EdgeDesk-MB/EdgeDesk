import { Flag } from "lucide-react";
import {
  AdminChartCard,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { ReleasesPanel } from "@/components/admin/releases-panel";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { buildFlagShare } from "@/lib/admin/activity-charts";
import { loadFlagsOverview } from "@/lib/admin/flags";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";
import { getLandingVariant, getSiteSurface } from "@/lib/site-surface";
import { surfaceLift } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function envSet(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function deployIdentity() {
  const env =
    process.env.VERCEL_ENV?.trim() ||
    (process.env.NODE_ENV === "production" ? "production" : "development");
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim() || null;
  const rawUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    null;
  const url = rawUrl
    ? rawUrl.startsWith("http")
      ? rawUrl
      : `https://${rawUrl}`
    : null;
  return { env, sha: sha ? sha.slice(0, 7) : null, branch, url };
}

export default async function AdminReleasesPage() {
  const [flags, banner] = await Promise.all([
    loadFlagsOverview(),
    readMaintenanceBanner(),
  ]);
  const flagsOn = flags.flags.filter((flag) => flag.active).length;
  const flagShare = buildFlagShare(flagsOn, flags.flags.length - flagsOn);
  const deploy = deployIdentity();
  const surface = getSiteSurface();
  const landing = getLandingVariant();
  const launchToggles = [
    { label: "Desk surface", value: surface === "app" ? "App" : "Waitlist", on: surface === "app" },
    { label: "Landing", value: landing === "launch" ? "Launch" : "Waitlist", on: landing === "launch" },
    { label: "Stripe live", value: envSet("STRIPE_SECRET_KEY") ? (process.env.STRIPE_SECRET_KEY!.startsWith("sk_live_") ? "Live" : "Test") : "Unset", on: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false },
    { label: "Banner", value: banner.enabled ? "On" : "Off", on: banner.enabled },
  ];
  return (
    <AdminPage
      title="Releases"
      description="Flags and the site banner."
      icon={Flag}
    >
      <AdminSection title="This deploy">
        <dl className={cn(surfaceLift, "grid gap-x-8 gap-y-2 rounded-lg px-4 py-4 sm:grid-cols-2 lg:grid-cols-4")}>
          <div>
            <dt className="text-[11px] text-muted-foreground">Environment</dt>
            <dd className="mt-0.5 text-sm font-medium capitalize text-foreground">{deploy.env}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Commit</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {deploy.sha ?? "—"}
              {deploy.branch ? <span className="text-muted-foreground"> · {deploy.branch}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Surface</dt>
            <dd className="mt-0.5 text-sm font-medium capitalize text-foreground">{surface}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">URL</dt>
            <dd className="mt-0.5 min-w-0 truncate text-sm font-medium text-foreground">
              {deploy.url ? (
                <a
                  href={deploy.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-text hover:underline"
                >
                  {deploy.url.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "localhost"
              )}
            </dd>
          </div>
        </dl>
      </AdminSection>

      <StatStrip columns={3}>
        <StatTile
          label="Flags"
          value={String(flags.flags.length)}
          sub={`${flagsOn} on`}
        />
        <StatTile label="Banner" value={banner.enabled ? "On" : "Off"} />
        <StatTile label="PostHog" value={flags.configured ? "Linked" : "Unset"} />
      </StatStrip>
      <AdminSection title="Launch state">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {launchToggles.map((toggle) => (
            <div
              key={toggle.label}
              className={cn(surfaceLift, "flex items-center justify-between gap-3 rounded-lg border border-transparent px-4 py-3")}
            >
              <span className="text-sm text-muted-foreground">{toggle.label}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-semibold",
                  toggle.on ? "text-profit" : "text-muted-foreground"
                )}
              >
                <span className={cn("size-1.5 rounded-full", toggle.on ? "bg-profit" : "bg-muted-foreground/50")} />
                {toggle.value}
              </span>
            </div>
          ))}
        </div>
      </AdminSection>

      {flags.flags.length > 0 ? (
        <AdminChartCard
          title="Flag state"
          description="On means PostHog reports the flag as active. Partial rollouts show the percentage on the flag below."
        >
          <AdminDonutChart slices={flagShare} label="Flag state" />
        </AdminChartCard>
      ) : null}
      <ReleasesPanel flags={flags} banner={banner} />
    </AdminPage>
  );
}
