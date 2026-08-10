import { afterEach, describe, expect, it, vi } from "vitest";
import { readSeenAlertKeys } from "./seen";
import {
  raceOffSoonAlertKey,
  suppressRaceOffSoonForBetLink,
} from "./race-off-soon-suppress";

describe("race-off-soon suppress", () => {
  afterEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* not stubbed */
    }
    vi.unstubAllGlobals();
  });

  it("builds the alert key used by evaluateAlertRules", () => {
    expect(raceOffSoonAlertKey(42)).toBe("race_off_soon:42");
  });

  it("seeds seen keys so AlertWatcher skips the prompt", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });

    suppressRaceOffSoonForBetLink(7);
    expect(readSeenAlertKeys().has("race_off_soon:7")).toBe(true);
  });

  it("ignores invalid event ids", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });

    suppressRaceOffSoonForBetLink(null);
    suppressRaceOffSoonForBetLink(undefined);
    suppressRaceOffSoonForBetLink(Number.NaN);
    expect(readSeenAlertKeys().size).toBe(0);
  });
});
