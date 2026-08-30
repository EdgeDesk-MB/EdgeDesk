import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { PageShell } from "@/components/page-shell";
import { cn } from "@/lib/utils";

/**
 * Full-page first-load spinner. Use while we do not yet know whether Neon
 * (or the page's own API) has line items. Do not flash an empty state.
 * The label (or description) is always visible so reduced-motion users
 * still get status when the spinner is still.
 */
export function PageLoading({
  label = "Loading …",
  description,
  className,
}: {
  label?: string;
  description?: string;
  className?: string;
}) {
  const copy = description ?? label;
  return (
    <PageShell fullHeight className={className}>
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        <Loader2
          className="size-6 motion-safe:animate-spin text-muted-foreground"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">{copy}</p>
      </div>
    </PageShell>
  );
}

/**
 * In-plate first-load: same EmptyState busy plate as other list gaps, so
 * the icon well and “will appear here” line stay consistent.
 */
export function PlateLoading({
  label,
  description,
  nested = false,
  className,
}: {
  label: string;
  description: string;
  /** Flatten the plate when it sits inside another Card (Profit Tracker). */
  nested?: boolean;
  className?: string;
}) {
  return (
    <EmptyState
      busy
      compact
      title={label}
      description={description}
      className={cn(nested && "shadow-none", className)}
    />
  );
}
