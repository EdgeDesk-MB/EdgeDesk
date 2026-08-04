import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

export type StatusBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Capitalize the first letter of the first word (underscores → spaces). */
export function formatPillLabel(label: string): string {
  const spaced = label.replace(/_/g, " ");
  if (!spaced) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function offerStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "active";
    case "completed":
      return "success";
    case "planned":
      return "outline";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

export function betStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "open":
      return "active";
    case "won":
    case "early_payout":
    case "half_win":
      return "success";
    case "lost":
    case "half_lose":
      return "destructive";
    case "void":
    case "push":
      return "secondary";
    default:
      return "outline";
  }
}

export function roadmapStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "done":
      return "success";
    case "in_progress":
      return "warning";
    case "planned":
    case "future":
      return "outline";
    default:
      return "outline";
  }
}
