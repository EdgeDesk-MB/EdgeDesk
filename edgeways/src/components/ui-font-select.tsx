"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiFont } from "@/components/ui-font-provider";
import {
  normalizeUiFont,
  UI_FONT_OPTIONS,
  type UiFontId,
} from "@/lib/ui-font";
import { Type } from "lucide-react";

export function UiFontSelect({
  onPersist,
}: {
  /** Optional save to AppSettings (Settings page). */
  onPersist?: (fontId: UiFontId) => void;
}) {
  const { fontId, setFontId } = useUiFont();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Type className="size-4 text-muted-foreground" aria-hidden />
        <Label htmlFor="ui-font" className="text-sm font-semibold">
          Font
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">Desk typeface.</p>
      <Select
        value={fontId}
        onValueChange={(v) => {
          const next = normalizeUiFont(v);
          setFontId(next);
          onPersist?.(next);
        }}
      >
        <SelectTrigger id="ui-font" className="max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UI_FONT_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.id}
              value={opt.id}
              style={
                opt.id === "figtree"
                  ? { fontFamily: "var(--font-figtree)" }
                  : { fontFamily: "var(--font-sans)" }
              }
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
