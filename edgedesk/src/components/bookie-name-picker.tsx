"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { filterBookmakers } from "@/lib/bookmakers";
import { cn } from "@/lib/utils";

const CUSTOM = "__custom__";

/** Bookie picker with list + manual custom name (Add balance, Settings). */
export function BookieNamePicker({
  value,
  onChange,
  label = "Bookie",
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  className?: string;
}) {
  const known = useMemo(() => filterBookmakers(""), []);
  const inList = known.some((b) => b.toLowerCase() === value.trim().toLowerCase());
  const [mode, setMode] = useState<"list" | "custom">(value && !inList ? "custom" : "list");
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState(value && !inList ? value : "");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "list") return;
    function onPointerDown(e: MouseEvent) {
      if (!listRef.current?.contains(e.target as Node)) setSearch("");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mode]);

  const options = useMemo(() => filterBookmakers(search), [search]);
  const showCustomSearch =
    search.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  const selectValue =
    mode === "custom" ? CUSTOM : value && inList ? value : value || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setMode("custom");
            setCustomName(value || "");
            onChange(customName || value || "");
            return;
          }
          setMode("list");
          setCustomName("");
          onChange(v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select bookie" />
        </SelectTrigger>
        <SelectContent>
          <div className="border-b p-2" ref={listRef}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookies…"
              className="h-8"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          {showCustomSearch && (
            <SelectItem value={search.trim()} onSelect={() => setMode("list")}>
              Use &ldquo;{search.trim()}&rdquo;
            </SelectItem>
          )}
          {options.map((name) => (
            <SelectItem key={name} value={name}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: bookieBrandColor(name) }}
                />
                {name}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM} className="text-muted-foreground">
            Add custom bookie…
          </SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <Input
          value={customName}
          onChange={(e) => {
            setCustomName(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Enter bookie name"
        />
      )}
    </div>
  );
}

export const EXCHANGE_CUSTOM = "__exchange_custom__";
