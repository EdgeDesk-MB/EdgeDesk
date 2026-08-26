"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Dev-only: keep a dialog "open" flag across Fast Refresh / provider remounts.
 *
 * Production is a no-op (plain useState). In development, the flag is mirrored
 * to sessionStorage so HMR remounts reopen the modal instead of dumping you
 * back to the page. Closing the dialog clears the sticky flag.
 *
 * Does not persist form field values — only that the shell should stay open.
 */
export function useDevStickyOpen(
  id: string,
  initial = false
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initial);
  const [ready, setReady] = useState(() => process.env.NODE_ENV !== "development");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        if (sessionStorage.getItem(storageKey(id)) === "1") {
          setOpen(true);
        }
      } catch {
        /* private mode / quota */
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!ready || process.env.NODE_ENV !== "development") return;
    try {
      if (open) sessionStorage.setItem(storageKey(id), "1");
      else sessionStorage.removeItem(storageKey(id));
    } catch {
      /* private mode / quota */
    }
  }, [id, open, ready]);

  return [open, setOpen];
}

/**
 * Dev-only companion for small JSON bags (e.g. viewSeedId) that should ride
 * along with a sticky-open dialog.
 */
export function useDevStickyJson<T>(
  id: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(() => process.env.NODE_ENV !== "development");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = sessionStorage.getItem(storageKey(id));
        if (raw != null) setValue(JSON.parse(raw) as T);
      } catch {
        /* ignore */
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!ready || process.env.NODE_ENV !== "development") return;
    try {
      if (value === null || value === undefined) {
        sessionStorage.removeItem(storageKey(id));
      } else {
        sessionStorage.setItem(storageKey(id), JSON.stringify(value));
      }
    } catch {
      /* ignore */
    }
  }, [id, value, ready]);

  return [value, setValue];
}

function storageKey(id: string) {
  return `edgeways:dev-dialog:${id}`;
}
