import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dismissAlertNotifications,
  readSeenAlertKeys,
  storeSeenAlertKeys,
  suppressAlertKeys,
} from "./seen";

describe("alert seen keys", () => {
  afterEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* not stubbed */
    }
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

  it("dismissAlertNotifications POSTs dismiss tags to /api/push", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { serviceWorker: undefined });

    await dismissAlertNotifications(["offer_expiring:offer-5-place_qualifying:2026-08-03", ""]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/push");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      dismiss: ["offer_expiring:offer-5-place_qualifying:2026-08-03"],
    });
  });
});
