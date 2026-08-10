import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeUserOriginatedAlertKey,
  isUserOriginatedAlertKey,
  markUserOriginatedAlertKeys,
  markUserSettledBetIds,
} from "./user-originated";

describe("user-originated alert keys", () => {
  afterEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* not stubbed */
    }
    vi.unstubAllGlobals();
  });

  function stubSessionStorage() {
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
  }

  it("marks and consumes result_settled keys for user settles", () => {
    stubSessionStorage();
    markUserSettledBetIds([42, null, 43]);
    expect(isUserOriginatedAlertKey("result_settled:42")).toBe(true);
    expect(isUserOriginatedAlertKey("result_settled:43")).toBe(true);
    expect(consumeUserOriginatedAlertKey("result_settled:42")).toBe(true);
    expect(isUserOriginatedAlertKey("result_settled:42")).toBe(false);
    expect(isUserOriginatedAlertKey("result_settled:43")).toBe(true);
  });

  it("is idempotent when re-marking the same key", () => {
    stubSessionStorage();
    markUserOriginatedAlertKeys(["result_settled:7"]);
    markUserOriginatedAlertKeys(["result_settled:7"]);
    expect(consumeUserOriginatedAlertKey("result_settled:7")).toBe(true);
    expect(consumeUserOriginatedAlertKey("result_settled:7")).toBe(false);
  });
});
