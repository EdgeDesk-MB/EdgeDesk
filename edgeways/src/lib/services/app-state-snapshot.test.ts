import { describe, expect, it } from "vitest";
import { jsonSnapshotUnchanged } from "./app-state-snapshot";

describe("jsonSnapshotUnchanged", () => {
  it("is false until there is a previous snapshot", () => {
    expect(jsonSnapshotUnchanged(null, { alertsUnread: 0 })).toBe(false);
    expect(jsonSnapshotUnchanged(undefined, { alertsUnread: 0 })).toBe(false);
  });

  it("is true when the payload is the same", () => {
    const row = { alertsUnread: 1, events: [{ id: 2, minute: 11 }] };
    expect(jsonSnapshotUnchanged(row, { ...row, events: [{ id: 2, minute: 11 }] })).toBe(
      true
    );
  });

  it("is false when live fields move", () => {
    const previous = { alertsUnread: 1, events: [{ id: 2, minute: 11 }] };
    expect(
      jsonSnapshotUnchanged(previous, { alertsUnread: 1, events: [{ id: 2, minute: 12 }] })
    ).toBe(false);
  });
});
