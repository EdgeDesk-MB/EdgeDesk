import { afterEach, describe, expect, it, vi } from "vitest";
import { readSeenAlertKeys, storeSeenAlertKeys, suppressAlertKeys } from "./seen";

describe("alert seen keys", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("suppressAlertKeys seeds sessionStorage so AlertWatcher will not re-fire", () => {
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
      get length() {
        return store.size;
      },
    } satisfies Storage);

    suppressAlertKeys(["naked_exposure:97"]);
    expect(readSeenAlertKeys().has("naked_exposure:97")).toBe(true);

    // Idempotent
    suppressAlertKeys(["naked_exposure:97"]);
    expect([...readSeenAlertKeys()]).toEqual(["naked_exposure:97"]);

    storeSeenAlertKeys(new Set(["other:1", "naked_exposure:97"]));
    expect(readSeenAlertKeys().has("other:1")).toBe(true);
  });
});
