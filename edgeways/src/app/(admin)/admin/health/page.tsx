import { HeartPulse } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { StripeModeChip } from "@/components/admin/stripe-mode-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime } from "@/lib/admin/format";
import { loadHealthReport, type HealthStatus } from "@/lib/admin/health";
import { stripeMode } from "@/lib/billing/stripe-server";
import {
  captionHeading,
  surfaceLift,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<HealthStatus, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  down: "bg-destructive",
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  ok: "text-success",
  warn: "text-warning",
  down: "text-destructive",
};

const OVERALL_COPY: Record<HealthStatus, { title: string; sub: string }> = {
  ok: { title: "All systems go", sub: "Every check passed." },
  warn: { title: "Running with warnings", sub: "Something needs a look, nothing is down." },
  down: { title: "Something is down", sub: "At least one check failed." },
};

export default async function AdminHealthPage() {
  const report = await loadHealthReport();
  const mode = stripeMode();
  const overall = OVERALL_COPY[report.overall];

  return (
    <AdminPage
      title="Health"
      description="Is it up, and which mode is it in?"
      icon={HeartPulse}
    >
      <section
        className={cn(surfaceLift, "flex items-center justify-between gap-4 rounded-lg px-4 py-4")}
        aria-label="Overall status"
      >
        <div className="flex items-center gap-3">
          <span className={cn("size-3 shrink-0 rounded-full", STATUS_DOT[report.overall])} />
          <div>
            <p className="text-base font-semibold leading-snug text-foreground">
              {overall.title}
            </p>
            <p className="text-xs text-muted-foreground">{overall.sub}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="capitalize">{report.surface} surface</p>
          <p>{formatAdminDateTime(report.generatedAt)}</p>
        </div>
      </section>

      <AdminSection title="Services">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.checks.map((check) => (
            <div
              key={check.key}
              className={cn(surfaceLift, "flex flex-col rounded-lg border border-transparent px-4 py-4")}
            >
              <p className="h-3.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
                {check.label}
              </p>
              <div className="mt-0.5 flex h-7 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[check.status])} />
                <span className={cn("text-lg font-bold leading-none", STATUS_TEXT[check.status])}>
                  {check.value}
                </span>
              </div>
              <p className="mt-2.5 h-3.5 truncate text-[11px] leading-none text-muted-foreground">
                {check.detail ?? "\u00a0"}
                {check.key === "stripe" && mode ? (
                  <span className="ml-1 align-middle"><StripeModeChip mode={mode} /></span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="Deploy">
        <div className={cn(surfaceLift, "rounded-lg px-4 py-4")}>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className={captionHeading}>Environment</dt>
              <dd className="mt-1 text-sm font-medium capitalize text-foreground">
                {report.deploy.env}
              </dd>
            </div>
            <div>
              <dt className={captionHeading}>Commit</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-foreground">
                {report.deploy.sha ?? "—"}
              </dd>
            </div>
            <div>
              <dt className={captionHeading}>Surface</dt>
              <dd className="mt-1 text-sm font-medium capitalize text-foreground">
                {report.surface} · {report.landingVariant}
              </dd>
            </div>
            <div>
              <dt className={captionHeading}>URL</dt>
              <dd className="mt-1 min-w-0 truncate text-sm font-medium text-foreground">
                {report.deploy.url ? (
                  <a
                    href={report.deploy.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-text hover:underline"
                  >
                    {report.deploy.url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "localhost"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </AdminSection>

      <AdminSection title="Exchange providers">
        {report.feeds.exchange.providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exchange providers configured.</p>
        ) : (
          <AdminTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeaderCell}>Provider</TableHead>
                  <TableHead className={tableHeaderCell}>Status</TableHead>
                  <TableHead className={tableHeaderCell}>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.feeds.exchange.providers.map((provider) => (
                  <TableRow key={provider.provider}>
                    <TableCell className={cn(tableBodyCell, "font-medium capitalize")}>
                      {provider.provider}
                    </TableCell>
                    <TableCell className={tableBodyCell}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            provider.ok ? "bg-success" : "bg-destructive"
                          )}
                        />
                        <span className={provider.ok ? "text-success" : "text-destructive"}>
                          {provider.status}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className={cn(tableBodyCell, "text-muted-foreground")}>
                      {provider.message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableFrame>
        )}
      </AdminSection>
    </AdminPage>
  );
}
