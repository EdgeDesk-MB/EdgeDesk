"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FocusScope } from "radix-ui/internal";
import { Label } from "@/components/ui/label";
import { useVenueAccounts, type VenueOption } from "@/hooks/use-venue-accounts";
import {
  accessStatusLabel,
  normalizeAccessStatus,
  type BookieAccessStatus,
} from "@/lib/accounts/access";
import { inferBackVenueKind } from "@/lib/accounts/resolve-venue";
import { filterBookmakers } from "@/lib/bookmakers";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

type PickerRow = {
  name: string;
  kind: "bookie" | "exchange";
  accessStatus: BookieAccessStatus | null;
  brandColor: string | null;
  section: "bookies" | "exchanges";
};

/** Exchange-ish names → exchange, else bookie. Shared with callers that defer persistence (e.g. the offer form's own auto-add checkbox). */
export function inferVenueKind(
  name: string,
  exchangeDirectory: VenueOption[],
  exchangeWallets: VenueOption[]
): "bookie" | "exchange" {
  const key = name.trim().toLowerCase();
  const asExchange =
    inferBackVenueKind(name) === "exchange" ||
    exchangeDirectory.some((e) => e.name.toLowerCase() === key) ||
    exchangeWallets.some((e) => e.name.toLowerCase() === key);
  return asExchange ? "exchange" : "bookie";
}

/**
 * Searchable Bookie / Exchange picker with free-type.
 * Free-typed names are saved as wallets (bookie or exchange).
 * Menu always portals to document.body (fixed) so dialog overflow cannot clip it.
 */
export function VenueSelect({
  value,
  onChange,
  label = "Bookie / Exchange",
  className,
  preferAvailable = true,
  /** Compact chip style (2UP / Add bet panels) */
  compact = false,
  /** Settings-style bordered trigger; `sm` matches ThemeSelect height (~32px) */
  size = "default",
  placeholder = "Select…",
  /** Which sections to show - default both */
  kinds = ["bookie", "exchange"],
  /** Allow typing a new name that is not in the list */
  allowCustom = true,
  /** Persist a free-typed name as a wallet immediately on pick. Set false to defer creation to the caller (e.g. save-time, gated by its own checkbox). */
  persistCustom = true,
  /** Override the trigger brand-colour dot (e.g. live colour picker before save). */
  brandColor: brandColorOverride = null,
  /** Hide wallets already on the account - directory + custom only (Add bookie / Add exchange). */
  omitExistingWallets = false,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  className?: string;
  preferAvailable?: boolean;
  compact?: boolean;
  size?: "default" | "sm";
  placeholder?: string;
  kinds?: Array<"bookie" | "exchange">;
  allowCustom?: boolean;
  persistCustom?: boolean;
  brandColor?: string | null;
  ariaLabel?: string;
  id?: string;
  omitExistingWallets?: boolean;
}) {
  const {
    bookieWallets,
    exchangeWallets,
    exchangeDirectory,
    statusByName,
    ensureVenue,
  } = useVenueAccounts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showBookies = kinds.includes("bookie");
  const showExchanges = kinds.includes("exchange");

  const existingWalletKeys = useMemo(() => {
    const set = new Set<string>();
    for (const w of bookieWallets) set.add(w.name.toLowerCase());
    for (const w of exchangeWallets) set.add(w.name.toLowerCase());
    return set;
  }, [bookieWallets, exchangeWallets]);

  const totalItemCount = useMemo(() => {
    let count = 0;
    if (showBookies) {
      const seenBookies = new Set<string>();
      if (!omitExistingWallets) {
        for (const w of bookieWallets) {
          if (preferAvailable && w.accessStatus === "closed") continue;
          seenBookies.add(w.name.toLowerCase());
          count++;
        }
      } else {
        for (const key of existingWalletKeys) seenBookies.add(key);
      }
      for (const name of filterBookmakers("")) {
        if (seenBookies.has(name.toLowerCase())) continue;
        count++;
      }
    }
    if (showExchanges) {
      const seenEx = new Set<string>();
      if (!omitExistingWallets) {
        for (const w of exchangeWallets) {
          if (preferAvailable && w.accessStatus === "closed") continue;
          seenEx.add(w.name.toLowerCase());
          count++;
        }
      } else {
        for (const key of existingWalletKeys) seenEx.add(key);
      }
      for (const e of exchangeDirectory) {
        if (seenEx.has(e.name.toLowerCase())) continue;
        count++;
      }
    }
    return count;
  }, [
    bookieWallets,
    exchangeWallets,
    exchangeDirectory,
    preferAvailable,
    showBookies,
    showExchanges,
    omitExistingWallets,
    existingWalletKeys,
  ]);

  const showSearch = totalItemCount > 10;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const bookies: PickerRow[] = [];
    if (showBookies) {
      const seenBookies = new Set<string>();

      if (!omitExistingWallets) {
        for (const w of bookieWallets) {
          if (preferAvailable && w.accessStatus === "closed") continue;
          if (q && !w.name.toLowerCase().includes(q)) continue;
          seenBookies.add(w.name.toLowerCase());
          bookies.push({
            name: w.name,
            kind: "bookie",
            accessStatus: w.accessStatus,
            brandColor: w.brandColor,
            section: "bookies",
          });
        }
      } else {
        for (const key of existingWalletKeys) seenBookies.add(key);
      }

      for (const name of filterBookmakers(search)) {
        if (seenBookies.has(name.toLowerCase())) continue;
        bookies.push({
          name,
          kind: "bookie",
          accessStatus: statusByName.get(name.toLowerCase()) ?? null,
          brandColor: null,
          section: "bookies",
        });
      }
    }

    const exchanges: PickerRow[] = [];
    if (showExchanges) {
      const seenEx = new Set<string>();

      if (!omitExistingWallets) {
        for (const w of exchangeWallets) {
          if (preferAvailable && w.accessStatus === "closed") continue;
          if (q && !w.name.toLowerCase().includes(q)) continue;
          seenEx.add(w.name.toLowerCase());
          exchanges.push({
            name: w.name,
            kind: "exchange",
            accessStatus: w.accessStatus,
            brandColor: w.brandColor,
            section: "exchanges",
          });
        }
      } else {
        for (const key of existingWalletKeys) seenEx.add(key);
      }

      for (const e of exchangeDirectory) {
        if (seenEx.has(e.name.toLowerCase())) continue;
        if (q && !e.name.toLowerCase().includes(q)) continue;
        exchanges.push({
          name: e.name,
          kind: "exchange",
          accessStatus: null,
          brandColor: e.brandColor,
          section: "exchanges",
        });
      }
    }

    return { bookies, exchanges };
  }, [
    bookieWallets,
    exchangeWallets,
    exchangeDirectory,
    search,
    preferAvailable,
    statusByName,
    showBookies,
    showExchanges,
    omitExistingWallets,
    existingWalletKeys,
  ]);

  const allNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of [...rows.bookies, ...rows.exchanges]) {
      set.add(r.name.toLowerCase());
    }
    if (omitExistingWallets) {
      for (const key of existingWalletKeys) set.add(key);
    }
    return set;
  }, [rows, omitExistingWallets, existingWalletKeys]);

  const showCustom =
    showSearch &&
    allowCustom &&
    search.trim().length > 0 &&
    !allNames.has(search.trim().toLowerCase());

  const valueStatus = value
    ? statusByName.get(value.trim().toLowerCase()) ?? null
    : null;

  const valueBrandColor = useMemo(() => {
    if (!value.trim()) return null;
    if (brandColorOverride?.trim()) return brandColorOverride.trim();
    const key = value.trim().toLowerCase();
    const exWallet = exchangeWallets.find((e) => e.name.toLowerCase() === key);
    if (exWallet?.brandColor) return exWallet.brandColor;
    const exDir = exchangeDirectory.find((e) => e.name.toLowerCase() === key);
    if (exDir?.brandColor) return exDir.brandColor;
    const bookieWallet = bookieWallets.find((b) => b.name.toLowerCase() === key);
    return bookieBrandColor(value, bookieWallet?.brandColor);
  }, [value, brandColorOverride, bookieWallets, exchangeWallets, exchangeDirectory]);

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const PAD = 8;
    const GAP = 4;
    const triggerRect = trigger.getBoundingClientRect();
    // Match the trigger width (side-nav / Settings fields). Compact chip menus
    // stay a fixed wider panel anchored to the right edge.
    const menuWidth = compact ? 224 : triggerRect.width;

    let left = compact ? triggerRect.right - menuWidth : triggerRect.left;
    left = Math.max(PAD, Math.min(left, window.innerWidth - menuWidth - PAD));

    const spaceBelow = window.innerHeight - triggerRect.bottom - PAD;
    const spaceAbove = triggerRect.top - PAD;
    // Prefer below; flip above when there is clearly more room there.
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, openBelow ? spaceBelow - GAP : spaceAbove - GAP);

    if (openBelow) {
      setMenuStyle({
        top: triggerRect.bottom + GAP,
        left,
        width: menuWidth,
        maxHeight,
      });
    } else {
      setMenuStyle({
        bottom: window.innerHeight - triggerRect.top + GAP,
        left,
        width: menuWidth,
        maxHeight,
      });
    }
  }

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => setMenuStyle(null));
      return;
    }
    queueMicrotask(() => {
      if (!showSearch) setSearch("");
      updatePosition();
      if (showSearch) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    });

    function onScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return;
      updatePosition();
    }
    const onResize = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, compact, showSearch]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function pick(name: string, kind: "bookie" | "exchange", persist: boolean) {
    onChange(name);
    setOpen(false);
    setSearch("");
    if (!persist) return;
    setSaving(true);
    try {
      const res = await ensureVenue(name, kind);
      if (res?.created) {
        toast.success(
          kind === "exchange" ? `Added exchange “${name}”` : `Added bookie “${name}”`
        );
      }
    } catch (e) {
      toast.error("Could not save wallet", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function pickCustom() {
    const name = search.trim();
    if (!name) return;
    if (showExchanges && !showBookies) {
      await pick(name, "exchange", persistCustom);
      return;
    }
    if (showBookies && !showExchanges) {
      await pick(name, "bookie", persistCustom);
      return;
    }
    await pick(name, inferVenueKind(name, exchangeDirectory, exchangeWallets), persistCustom);
  }

  function rowButton(row: PickerRow) {
    const status = row.accessStatus;
    const gubbed = status === "gubbed";
    const color = row.brandColor ?? bookieBrandColor(row.name);
    return (
      <li key={`${row.section}-${row.name}`}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted",
            gubbed && "opacity-70"
          )}
          onClick={() => void pick(row.name, row.kind, false)}
        >
          <span
            className="inline-block size-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          {status && status !== "available" && (
            <span
              className={cn(
                "shrink-0 text-[11px]",
                status === "gubbed"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {accessStatusLabel(status)}
            </span>
          )}
          <Check
            className={cn(
              "size-3 shrink-0",
              value === row.name ? "opacity-100" : "opacity-0"
            )}
          />
        </button>
      </li>
    );
  }

  // FocusScope pauses a parent Dialog trap so the portaled search field can
  // accept typing (menu is on document.body, outside DialogContent).
  const menu =
    open && menuStyle ? (
      <FocusScope.Root
        asChild
        trapped
        onUnmountAutoFocus={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <div
          ref={menuRef}
          data-venue-select-menu
          className="pointer-events-auto fixed z-[10000] flex flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
          style={{
            top: menuStyle.top,
            bottom: menuStyle.bottom,
            left: menuStyle.left,
            width: menuStyle.width,
            maxHeight: menuStyle.maxHeight,
          }}
        >
          {showSearch ? (
            <div className="shrink-0 border-b p-2">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCustom) {
                    e.preventDefault();
                    void pickCustom();
                  }
                }}
                placeholder="Search or type a name…"
                className="h-8 w-full rounded-md border-0 bg-muted px-2 text-xs outline-none ring-primary/40 focus:ring-2"
              />
            </div>
          ) : null}
          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 text-xs"
            onWheel={(e) => e.stopPropagation()}
          >
            {showCustom && (
              <li>
                <button
                  type="button"
                  className="flex w-full px-3 py-1.5 text-left hover:bg-muted"
                  disabled={saving}
                  onClick={() => void pickCustom()}
                >
                  Add &ldquo;{search.trim()}&rdquo;
                </button>
              </li>
            )}
            {rows.bookies.length > 0 && (
              <>
                {showBookies && showExchanges ? (
                  <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Bookies
                  </li>
                ) : null}
                {rows.bookies.map(rowButton)}
              </>
            )}
            {rows.exchanges.length > 0 && (
              <>
                {showBookies && showExchanges ? (
                  <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Exchanges
                  </li>
                ) : null}
                {rows.exchanges.map(rowButton)}
              </>
            )}
            {rows.bookies.length === 0 && rows.exchanges.length === 0 && !showCustom && (
              <li className="px-3 py-2 text-muted-foreground">No matches</li>
            )}
          </ul>
        </div>
      </FocusScope.Root>
    ) : null;

  const trigger = compact ? (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        // Ghost on the panel tint: quiet hover only; brand ring on keyboard focus, not click
        "flex h-[33px] max-w-[148px] items-center gap-1 rounded-md border-0 bg-transparent px-2 text-xs font-bold text-black/85 outline-none transition-colors",
        "hover:bg-black/8 dark:text-white/95 dark:hover:bg-white/10",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        open && "bg-black/8 dark:bg-white/10",
        !value && "text-black/45 dark:text-white/45"
      )}
      title={
        valueStatus && valueStatus !== "available"
          ? `${value} · ${accessStatusLabel(normalizeAccessStatus(valueStatus))}`
          : undefined
      }
    >
      <span className="min-w-0 flex-1 truncate text-left">{value || "Bookie"}</span>
      {valueStatus === "gubbed" && (
        <span className="shrink-0 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          G
        </span>
      )}
      <ChevronsUpDown className="size-3 shrink-0 opacity-60" />
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        fieldControl,
        "flex w-full items-center gap-2 outline-none hover:bg-muted dark:hover:bg-input/50",
        size === "sm"
          ? "h-8 px-2.5 text-xs"
          : "h-9 px-3 text-sm",
        !value && "text-muted-foreground"
      )}
    >
      {value ? (
        <span
          className={cn(
            "inline-block shrink-0 rounded-full",
            size === "sm" ? "size-2" : "size-3"
          )}
          style={{ backgroundColor: valueBrandColor ?? undefined }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">{value || placeholder}</span>
      {valueStatus === "gubbed" && (
        <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
          {accessStatusLabel("gubbed")}
        </span>
      )}
      <ChevronsUpDown
        className={cn(
          "shrink-0 opacity-50",
          size === "sm" ? "size-3" : "size-3.5"
        )}
      />
    </button>
  );

  return (
    <>
      <div className={cn(compact ? "relative" : "flex flex-col gap-1.5", className)}>
        {!compact && label ? (
          <Label className="text-xs text-muted-foreground">{label}</Label>
        ) : null}
        {trigger}
        {valueStatus && valueStatus !== "available" && !compact && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Marked {accessStatusLabel(normalizeAccessStatus(valueStatus))} in Settings
          </p>
        )}
      </div>
      {menu && createPortal(menu, document.body)}
    </>
  );
}
