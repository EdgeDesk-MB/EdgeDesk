import { describe, expect, it } from "vitest";
import {
  applyDeskExchangeRates,
  type DeskExchangeOverlay,
} from "@/lib/db/desk-exchange-rates";
import type { ExchangeRow } from "@/lib/db/schema";

function exchange(
  id: number,
  name: string,
  commissionPct: number,
  isDefault: number
): ExchangeRow {
  return {
    id,
    name,
    commissionPct,
    brandColor: "#ffb80c",
    backColor: "#a6d8ff",
    layColor: "#fac9d1",
    isDefault,
    createdAt: 1,
  };
}

describe("applyDeskExchangeRates", () => {
  it("keeps a 0% overlay instead of falling back to the 5% catalog rate", () => {
    const overlays = new Map<number, DeskExchangeOverlay>([
      [1, { commissionPct: 0, isDefault: false }],
    ]);
    const [row] = applyDeskExchangeRates([exchange(1, "Betfair", 5, 1)], overlays);
    expect(row?.commissionPct).toBe(0);
    expect(row?.isDefault).toBe(1);
  });

  it("makes the overlaid exchange the desk default instead of catalog Betfair", () => {
    const catalog = [
      exchange(1, "Betfair", 5, 1),
      exchange(2, "Betdaq", 2, 0),
    ];
    const overlays = new Map<number, DeskExchangeOverlay>([
      [2, { commissionPct: 2, isDefault: true }],
    ]);
    const rows = applyDeskExchangeRates(catalog, overlays);
    expect(rows.find((row) => row.name === "Betfair")?.isDefault).toBe(0);
    expect(rows.find((row) => row.name === "Betdaq")?.isDefault).toBe(1);
  });

  it("leaves catalog rates alone when this desk has no overlay", () => {
    const [row] = applyDeskExchangeRates(
      [exchange(1, "Betfair", 5, 1)],
      new Map()
    );
    expect(row?.commissionPct).toBe(5);
    expect(row?.isDefault).toBe(1);
  });
});
