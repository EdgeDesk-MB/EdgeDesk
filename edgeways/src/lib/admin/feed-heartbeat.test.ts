import { describe, expect, it } from "vitest";

// parseHeartbeat is not exported, so exercise the public record/read contract
// against the SQLite path (EDGEWAYS_DB_PATH temp file, set by the test env).
import {
  readFeedHeartbeat,
  recordFeedHeartbeat,
} from "@/lib/admin/feed-heartbeat";

describe("feed heartbeat", () => {
  it("records a success and clears any prior error", async () => {
    await recordFeedHeartbeat("football", { ok: false, message: "boom" }, 1000);
    await recordFeedHeartbeat("football", { ok: true }, 2000);
    const hb = await readFeedHeartbeat("football");
    expect(hb.lastOkAt).toBe(2000);
    expect(hb.lastError).toBeNull();
    // lastErrorAt is kept as history even after recovery.
    expect(hb.lastErrorAt).toBe(1000);
  });

  it("records a failure and keeps the message", async () => {
    await recordFeedHeartbeat("racing", { ok: true }, 500);
    await recordFeedHeartbeat("racing", { ok: false, message: "timeout" }, 1500);
    const hb = await readFeedHeartbeat("racing");
    expect(hb.lastOkAt).toBe(500);
    expect(hb.lastErrorAt).toBe(1500);
    expect(hb.lastError).toBe("timeout");
  });

  it("returns empty for a feed with no records", async () => {
    const hb = await readFeedHeartbeat("exchange");
    expect(hb).toEqual({ lastOkAt: null, lastErrorAt: null, lastError: null });
  });
});
