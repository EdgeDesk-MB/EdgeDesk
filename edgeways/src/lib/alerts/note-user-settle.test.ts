import { afterEach, describe, expect, it, vi } from "vitest";
import {
  noteUserOriginatedSettlesFromRequest,
  noteUserOriginatedSettlesFromResponse,
} from "./note-user-settle";
import { isUserOriginatedAlertKey } from "./user-originated";

describe("noteUserOriginatedSettles", () => {
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

  it("marks a direct bet PATCH settle from the request (before fetch)", () => {
    stubSessionStorage();
    noteUserOriginatedSettlesFromRequest("/api/bets/42", {
      status: "won",
      actualProfit: 0,
    });
    expect(isUserOriginatedAlertKey("result_settled:42")).toBe(true);
  });

  it("does not mark reopening a bet", () => {
    stubSessionStorage();
    noteUserOriginatedSettlesFromRequest("/api/bets/42", { status: "open" });
    expect(isUserOriginatedAlertKey("result_settled:42")).toBe(false);
  });

  it("marks boost diary outcome settles from the linked bet response", () => {
    stubSessionStorage();
    noteUserOriginatedSettlesFromResponse(
      "/api/boosts/9",
      { outcome: "won" },
      { bet: { id: 77 }, entry: {} }
    );
    expect(isUserOriginatedAlertKey("result_settled:77")).toBe(true);
  });

  it("marks bet-builder whole-ticket settles from the run response", () => {
    stubSessionStorage();
    noteUserOriginatedSettlesFromResponse(
      "/api/bet-builder/3",
      { result: "won" },
      { run: { backBetId: 10, wholeLayBetId: 11 } }
    );
    expect(isUserOriginatedAlertKey("result_settled:10")).toBe(true);
    expect(isUserOriginatedAlertKey("result_settled:11")).toBe(true);
  });

  it("marks Acca campaign complete when the last leg is set from the desk", () => {
    stubSessionStorage();
    noteUserOriginatedSettlesFromResponse(
      "/api/acca/legs/4",
      { result: "won" },
      { leg: { layBetId: 22 }, runCompleted: true, runId: 7 }
    );
    expect(isUserOriginatedAlertKey("result_settled:22")).toBe(true);
    expect(isUserOriginatedAlertKey("acca_complete:7")).toBe(true);
  });
});
