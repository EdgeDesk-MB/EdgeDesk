"use client";

import { useCallback, useState } from "react";
import { nextManualLayStake } from "@/lib/calculator-lay-stake";

/** Calculator lay stake: auto until typed, then Manual until cleared or reset. */
export function useManualLayStake(planReady: boolean) {
  const [manual, setManual] = useState<number | null>(null);
  const commit = useCallback(
    (typed: number) => setManual((cur) => nextManualLayStake(cur, typed, planReady)),
    [planReady]
  );
  const reset = useCallback(() => setManual(null), []);
  return { manual, isManual: manual != null, commit, reset, setManual };
}
