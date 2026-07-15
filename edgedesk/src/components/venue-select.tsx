"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Label } from "@/components/ui/label";
import { useVenueAccounts } from "@/hooks/use-venue-accounts";
import {
  accessStatusLabel,
  normalizeAccessStatus,
  type BookieAccessStatus,
} from "@/lib/accounts/access";
import { filterBookmakers } from "@/lib/bookmakers";
import { bookieBrandColor } from "@/lib/brands/bookies";
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

function dialogPortalRoot(from: HTMLElement | null): HTMLElement | null {
  const dialog = from?.closest("[data-slot='dialog-content']") as HTMLElement | null;
  if (!dialog) return null;
  return (
    (dialog.querySelector("[data-dialog-overlay-portal]") as HTMLElement | null) ?? dialog
  );
}

/**
 * Searchable Bookie / Exchange picker with free-type.
 * Free-typed names are saved as wallets (bookie or exchange).
 */
export function VenueSelect({
  value,
  onChange,
  label = "Bookie / Exchange",
  className,
  preferAvailable = true,
  /** Compact chip style (2UP / Add bet panels) */
  compact = false,
  placeholder = "Select…",
  /** Which sections to show - default both */
  kinds = ["bookie", "exchange"],
  /** Allow typing a new name that is not in the list */
  allowCustom = true,
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  className?: string;
  preferAvailable?: boolean;
  compact?: boolean;
  placeholder?: string;
  kinds?: Array<"bookie" | "exchange">;
  allowCustom?: boolean;
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
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showBookies = kinds.includes("bookie");
  const showExchanges = kinds.includes("exchange");

  const totalItemCount = useMemo(() => {
    let count = 0;
    if (showBookies) {
      const seenBookies = new Set<string>();
      for (const w of bookieWallets) {
        if (preferAvailable && w.accessStatus === "closed") continue;
        seenBookies.add(w.name.toLowerCase());
        count++;
      }
      for (const name of filterBookmakers("")) {
        if (seenBookies.has(name.toLowerCase())) continue;
        count++;
      }
    }
    if (showExchanges) {
      const seenEx = new Set<string>();
      for (const w of exchangeWallets) {
        if (preferAvailable && w.accessStatus === "closed") continue;
        seenEx.add(w.name.toLowerCase());
        count++;
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
  ]);

  const showSearch = totalItemCount > 10;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const bookies: PickerRow[] = [];
    if (showBookies) {
      const seenBookies = new Set<string>();

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
  ]);

  const allNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of [...rows.bookies, ...rows.exchanges]) {
      set.add(r.name.toLowerCase());
    }
    return set;
  }, [rows]);

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
    const key = value.trim().toLowerCase();
    const exWallet = exchangeWallets.find((e) => e.name.toLowerCase() === key);
    if (exWallet?.brandColor) return exWallet.brandColor;
    const exDir = exchangeDirectory.find((e) => e.name.toLowerCase() === key);
    if (exDir?.brandColor) return exDir.brandColor;
    return bookieBrandColor(value);
  }, [value, exchangeWallets, exchangeDirectory]);

  function updatePosition(root?: HTMLElement | null) {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const portalRoot = root ?? dialogPortalRoot(trigger);
    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = compact
      ? 224
      : Math.max(triggerRect.width, 260);

    if (portalRoot) {
      const rootRect = portalRoot.getBoundingClientRect();
      let left = compact
        ? triggerRect.right - rootRect.left - menuWidth
        : triggerRect.left - rootRect.left;
      left = Math.max(8, Math.min(left, rootRect.width - menuWidth - 8));
      const top = triggerRect.bottom - rootRect.top + 4;
      setMenuStyle({ top, left, width: menuWidth });
      return;
    }

    let left = compact ? triggerRect.right - menuWidth : triggerRect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setMenuStyle({ top: triggerRect.bottom + 4, left, width: menuWidth });
  }

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setMenuStyle(null);
        setPortalTarget(null);
      });
      return;
    }
    const root = dialogPortalRoot(triggerRef.current);
    queueMicrotask(() => {
      setPortalTarget(root ?? document.body);
      if (!showSearch) setSearch("");
      updatePosition(root);
      if (showSearch) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    });

    function onScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return;
      updatePosition(root);
    }
    const onResize = () => updatePosition(root);
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
      await pick(name, "exchange", true);
      return;
    }
    if (showBookies && !showExchanges) {
      await pick(name, "bookie", true);
      return;
    }
    // Both sections: exchange-ish names → exchange, else bookie
    const asExchange =
      /\b(exchange|betfair|betdaq|smarkets|matchbook)\b/i.test(name) ||
      exchangeDirectory.some((e) => e.name.toLowerCase() === name.toLowerCase()) ||
      exchangeWallets.some((e) => e.name.toLowerCase() === name.toLowerCase());
    await pick(name, asExchange ? "exchange" : "bookie", true);
  }

  const inDialog = portalTarget?.hasAttribute("data-dialog-overlay-portal");

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
          <Check
            className={cn(
              "size-3 shrink-0",
              value === row.name ? "opacity-100" : "opacity-0"
            )}
          />
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          {status && status !== "available" && (
            <span
              className={cn(
                "shrink-0 text-[10px]",
                status === "gubbed"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {accessStatusLabel(status)}
            </span>
          )}
        </button>
      </li>
    );
  }

  const menu =
    open && menuStyle ? (
      <div
        ref={menuRef}
        data-venue-select-menu
        className={cn(
          "pointer-events-auto overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg",
          inDialog ? "absolute z-[200]" : "fixed z-[10000]"
        )}
        style={{
          top: menuStyle.top,
          left: menuStyle.left,
          width: menuStyle.width,
        }}
      >
        {showSearch ? (
          <div className="border-b p-2">
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
          className="max-h-64 overflow-y-auto overscroll-contain py-1 text-xs"
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
              <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bookies
              </li>
              {rows.bookies.map(rowButton)}
            </>
          )}
          {rows.exchanges.length > 0 && (
            <>
              <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Exchanges
              </li>
              {rows.exchanges.map(rowButton)}
            </>
          )}
          {rows.bookies.length === 0 && rows.exchanges.length === 0 && !showCustom && (
            <li className="px-3 py-2 text-muted-foreground">No matches</li>
          )}
        </ul>
      </div>
    ) : null;

  const trigger = compact ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "flex h-[33px] max-w-[148px] items-center gap-1 rounded-md border-0 bg-[var(--pi)] px-2 text-xs font-bold text-black/85 outline-none ring-primary/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95",
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
        <span className="shrink-0 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
          G
        </span>
      )}
      <ChevronsUpDown className="size-3 shrink-0 opacity-60" />
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm outline-none ring-primary/40 focus:ring-2",
        !value && "text-muted-foreground"
      )}
    >
      {value ? (
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: valueBrandColor ?? undefined }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">{value || placeholder}</span>
      {valueStatus === "gubbed" && (
        <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
          {accessStatusLabel("gubbed")}
        </span>
      )}
      <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
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
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Marked {accessStatusLabel(normalizeAccessStatus(valueStatus))} in Settings
          </p>
        )}
      </div>
      {menu && portalTarget && createPortal(menu, portalTarget)}
    </>
  );
}
