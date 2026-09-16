import { bookieBrandColor } from "@/lib/brands/bookies";
import {
  exchangeBackColor,
  exchangeLayColor,
  findExchangePreset,
  muteForDark,
  muteForLight,
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

function plateFromSource(source: string | null): PlateTint {
  if (!source) return EMPTY_PLATE;
  return { light: muteForLight(source), dark: muteForDark(source) };
}

/** Back plate: exchange back cell, bookie brand, or empty. Both go through mute. */
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
      return plateFromSource(exchangeBackColor(venueName, override));
    }
    return plateFromSource(bookieBrandColor(venueName, venueBrandOverride));
  }
  if (exchange?.name.trim()) {
    return plateFromSource(exchangeBackColor(exchange.name, exchange.backColor));
  }
  return EMPTY_PLATE;
}

/** Lay plate: exchange lay cell, or empty until one is selected. */
export function resolveLayPlateColors(
  exchange?: { name: string; layColor?: string | null } | null
): PlateTint {
  if (!exchange?.name.trim()) return EMPTY_PLATE;
  return plateFromSource(exchangeLayColor(exchange.name, exchange.layColor));
}
