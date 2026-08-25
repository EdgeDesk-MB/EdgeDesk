"use client";

import { ShortcutKeys } from "@/components/ui/kbd";
import { usePreferMetaModifier } from "@/hooks/use-prefer-meta-modifier";
import {
  formatShortcutKeys,
  groupShortcutRows,
  type ShortcutRow,
} from "@/lib/keyboard/desk-shortcut-sheet";
import { cn } from "@/lib/utils";
import { captionHeading, listRow, listRowGroup } from "@/lib/ui/surface-styles";

export function ShortcutRowList({
  rows,
  grouped = false,
}: {
  rows: ReadonlyArray<ShortcutRow>;
  grouped?: boolean;
}) {
  const isMac = usePreferMetaModifier();

  const blocks = grouped
    ? groupShortcutRows(rows)
    : [{ id: "all" as const, label: "", rows: [...rows] }];

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => {
        const list = (
          <ul className={cn(listRowGroup, block.label && "mt-1.5")}>
            {block.rows.map((row) => {
              const hideModifier = Boolean(row.chord.withMod) && isMac === null;
              return (
                <li
                  key={row.id}
                  className={cn(
                    listRow,
                    "flex items-center justify-between gap-4 py-2"
                  )}
                >
                  <span className="min-w-0 text-pretty break-words text-sm text-foreground">
                    {row.label}
                  </span>
                  <ShortcutKeys
                    className={cn("shrink-0", hideModifier && "invisible")}
                    keys={formatShortcutKeys(row.chord, isMac === true)}
                    kind={row.chord.kind}
                  />
                </li>
              );
            })}
          </ul>
        );

        if (!block.label) {
          return (
            <div key={block.id} className="min-w-0">
              {list}
            </div>
          );
        }

        return (
          <section key={block.id} className="min-w-0">
            <h3 className={captionHeading}>{block.label}</h3>
            {list}
          </section>
        );
      })}
    </div>
  );
}
