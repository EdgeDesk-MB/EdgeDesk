"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Local-state text field that commits to the parent on a short debounce / blur.
 * Keeps typing snappy inside heavy forms (Add bet) where every parent setState
 * would otherwise rebuild large select trees and NumberFlow panels.
 */
export function DeferredTextInput({
  value,
  onCommit,
  commitMs = 200,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
  /** Parent sync delay while typing. Blur always flushes immediately. */
  commitMs?: number;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRef = useRef(local);

  if (prevValue !== value) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    localRef.current = local;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function flush(next: string) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommit(next);
  }

  return (
    <Input
      {...props}
      className={cn(className)}
      value={local}
      onChange={(e) => {
        const next = e.target.value;
        setLocal(next);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onCommit(next);
        }, commitMs);
      }}
      onBlur={() => flush(localRef.current)}
    />
  );
}
