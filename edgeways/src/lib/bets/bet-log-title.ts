import { formatPillLabel } from "@/lib/ui/status-badges";

/**
 * Tracker type caption under the bet title. Dutch (and similar) labels already
 * start with the type ("Dutch · Home / Draw / Away"), so repeating "Dutch" on
 * the muted line is noise.
 */
export function betLogTypeCaption(title: string, betType: string): string | null {
  const typeLabel = formatPillLabel(betType).trim();
  if (!typeLabel) return null;
  if (titleNamesBetType(title, typeLabel)) return null;
  return typeLabel;
}

function titleNamesBetType(title: string, typeLabel: string): boolean {
  const t = title.trim();
  if (!t) return false;
  const escaped = typeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s·:])${escaped}(?=$|[\\s·:])`, "i").test(t);
}
