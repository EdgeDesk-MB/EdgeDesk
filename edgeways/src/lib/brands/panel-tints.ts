import { bookieBrandColor, bookiePanelTint } from "@/lib/brands/bookies";
import {
  exchangeBackColor,
  exchangeBackColorDark,
  exchangeLayColor,
  exchangeLayColorDark,
  findExchangePreset,
  muteForDark,
} from "@/lib/brands/exchanges";

export type PlateTint = {
  light: string | null;
  dark: string | null;
};

const EMPTY_PLATE: PlateTint = { light: null, dark: null };

function isExchangeVenue(
  name: string,
  exchange?: { name: string } | null
): boolean {
  if (findExchangePreset(name)) return true;
  return !!exchange?.name && exchange.name.trim().toLowerCase() === name.toLowerCase();
}

/** Back plate: exchange back cell, bookie pastel, or empty. */
export function resolveBackPlateColors(
  venue: string | undefined,
  exchange?: { name: string; backColor?: string | null } | null,
  venueBrandOverride?: string | null
): PlateTint {
  const venueName = venue?.trim();
  if (venueName) {
    if (isExchangeVenue(venueName, exchange)) {
      const override =
        exchange?.name.trim().toLowerCase() === venueName.toLowerCase()
          ? exchange.backColor
          : undefined;
      return {
        light: exchangeBackColor(venueName, override),
        dark: exchangeBackColorDark(venueName, override),
      };
    }
    const light = bookiePanelTint(venueName, venueBrandOverride);
    // Dark uses the Settings brand, not the already-washed light pastel,
    // so Betfair yellow stays yellow instead of a greyed-out cream.
    return { light, dark: muteForDark(bookieBrandColor(venueName, venueBrandOverride)) };
  }
  if (exchange?.name.trim()) {
    return {
      light: exchangeBackColor(exchange.name, exchange.backColor),
      dark: exchangeBackColorDark(exchange.name, exchange.backColor),
    };
  }
  return EMPTY_PLATE;
}

/** Lay plate: exchange lay cell, or empty until one is selected. */
export function resolveLayPlateColors(
  exchange?: { name: string; layColor?: string | null } | null
): PlateTint {
  if (!exchange?.name.trim()) return EMPTY_PLATE;
  return {
    light: exchangeLayColor(exchange.name, exchange.layColor),
    dark: exchangeLayColorDark(exchange.name, exchange.layColor),
  };
}
