import type { HelpGuide } from "@/content/help/guides";
import { ShortcutRowList } from "@/components/keyboard/shortcut-row-list";
import {
  HELP_EVERYDAY_SHORTCUTS,
  SHORTCUT_SHEET_ROWS,
} from "@/lib/keyboard/desk-shortcut-sheet";

const HELP_SHORTCUT_BY_ID = new Map(
  [...SHORTCUT_SHEET_ROWS, ...HELP_EVERYDAY_SHORTCUTS].map((row) => [row.id, row])
);

export function HelpGuideContent({ guide }: { guide: HelpGuide }) {
  return (
    <article className="prose-sm max-w-none space-y-6">
      {guide.sections.map((section, i) => {
        const shortcuts = (section.shortcutIds ?? [])
          .map((id) => HELP_SHORTCUT_BY_ID.get(id))
          .filter((row): row is NonNullable<typeof row> => row != null);
        return (
          <section key={i} className="space-y-2">
            {section.heading && (
              <h2 className="text-base font-semibold tracking-tight">{section.heading}</h2>
            )}
            {section.paragraphs?.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {shortcuts.length > 0 ? (
              <ShortcutRowList rows={shortcuts} grouped={shortcuts.length > 3} />
            ) : null}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </article>
  );
}
