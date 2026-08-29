import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hosted: false,
}));

vi.mock("@/lib/db/desk-backend", () => ({
  isNeonDesk: () => mocks.hosted,
}));

import { blockHostedDeskMutation } from "./hosted-desk-guard";

describe("blockHostedDeskMutation", () => {
  beforeEach(() => {
    mocks.hosted = false;
  });

  it("lets SQLite desks write", () => {
    expect(blockHostedDeskMutation("Acca Desk")).toBeNull();
  });

  it("refuses hosted writes that would still hit SQLite", async () => {
    mocks.hosted = true;
    const res = blockHostedDeskMutation("Acca Desk");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    await expect(res!.json()).resolves.toEqual({
      error: "Acca Desk is not available on the hosted desk yet.",
    });
  });
});
