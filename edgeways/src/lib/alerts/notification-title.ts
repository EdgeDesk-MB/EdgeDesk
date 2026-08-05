/**
 * Lock-screen titles: exactly one leading emoji.
 * Alert rules own semantic marks (🟢/🔴/⚠/🔒/⏰/⚡); push must not stack another ⚡.
 */

/** Collapse stacked brand bolts, keep a semantic emoji, else prepend brand ⚡. */
export function ensureNotificationTitleEmoji(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "⚡ edgeways";

  // Older push + rule titles could stack "⚡ ⚡ …"
  const withoutBrandBolts = trimmed.replace(/^(?:⚡\s*)+/u, "").trim();
  if (!withoutBrandBolts) return "⚡ edgeways";

  if (/^\p{Extended_Pictographic}/u.test(withoutBrandBolts)) {
    return withoutBrandBolts;
  }
  return `⚡ ${withoutBrandBolts}`;
}
