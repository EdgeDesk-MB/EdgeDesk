/**
 * Acca card headline for a square run. Mid-run cover is "if this loses",
 * not "worst outcome". Platform provisional still uses accaSquareProvisional.
 */

import type { AccaMethodKind, AccaSquareProvisional } from "@/lib/calc/acca-workflow";

export type AccaSquareHeadlineLeg = {
  seq: number;
  label: string;
  result: "pending" | "won" | "lost" | "void";
};

export type AccaSquareHeadline =
  | {
      mode: "locked" | "worst";
      label: "Locked" | "Worst outcome";
      value: number;
    }
  | {
      mode: "cover";
      loseLabel: string;
      value: number;
      nextVerb: "lock" | "lay";
      nextLabel: string;
      winEst: number | null;
      winEstProxy: boolean;
    };

export function accaSquareHeadline(input: {
  square: AccaSquareProvisional;
  method: AccaMethodKind;
  legs: AccaSquareHeadlineLeg[];
  allWinEst: { value: number; usedProxy: boolean } | null;
}): AccaSquareHeadline {
  const { square, method, legs, allWinEst } = input;
  const pendingOthers = legs.filter(
    (l) => l.result === "pending" && l.seq !== square.squareLegSeq
  );
  const midRunCover =
    square.kind === "worst" &&
    square.squareLegSeq != null &&
    pendingOthers.length > 0 &&
    (method === "sequential" || method === "insurance_legs");

  if (!midRunCover) {
    return {
      mode: square.kind,
      label: square.kind === "locked" ? "Locked" : "Worst outcome",
      value: square.value,
    };
  }

  const squareLeg = legs.find((l) => l.seq === square.squareLegSeq);
  const next = [...pendingOthers].sort((a, b) => a.seq - b.seq)[0]!;
  const nextIsFinalLock = method === "sequential" && pendingOthers.length === 1;
  const loseName = squareLeg?.label.trim();

  return {
    mode: "cover",
    loseLabel: loseName ? `If ${loseName} loses` : "If this loses",
    value: square.value,
    nextVerb: nextIsFinalLock ? "lock" : "lay",
    nextLabel: next.label.trim() || "next leg",
    winEst: allWinEst?.value ?? null,
    winEstProxy: allWinEst?.usedProxy ?? false,
  };
}
