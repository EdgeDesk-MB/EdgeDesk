import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureServerEvent } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
}));
vi.mock("@/lib/analytics/server-capture", () => ({ captureServerEvent }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_bet_journey" }),
  currentUser: async () => null,
}));
vi.mock("@/lib/entitlements/feed-guard", () => ({
  deniedFeatureResponse: async () => null,
}));

import { POST } from "@/app/api/bets/route";
import { POST as POST_BET_BUILDER } from "@/app/api/bet-builder/route";

const betFields = {
  label: "Arsenal v Spurs",
  bookmaker: "Bet365",
  backStake: 10,
  backOdds: 2.5,
  layStake: 10.2,
  layOdds: 2.52,
  notes: "free text",
};

async function logBet(extra: Record<string, unknown> = {}) {
  const res = await POST(
    new NextRequest("http://localhost/api/bets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...betFields, ...extra }),
    })
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { bet: { id: number; source: string | null } };
}

describe("bet_logged on POST /api/bets", () => {
  beforeEach(() => captureServerEvent.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it("fires once per new bet: manual then slip import, first flagged", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { bet } = await logBet({ analyticsSource: "manual" });
    await logBet({ analyticsSource: "slip_import" });

    expect(captureServerEvent).toHaveBeenCalledTimes(2);
    expect(captureServerEvent.mock.calls[0]).toEqual([
      "user_bet_journey",
      "bet_logged",
      { source: "manual", is_first: true },
    ]);
    expect(captureServerEvent.mock.calls[1]).toEqual([
      "user_bet_journey",
      "bet_logged",
      { source: "slip_import", is_first: false },
    ]);
    // The analytics field is never written to the bet row.
    expect(bet.source).not.toBe("manual");

    const sent = JSON.stringify(captureServerEvent.mock.calls);
    for (const value of ["Arsenal", "Bet365", "2.5", "10.2", "free text"]) {
      expect(sent).not.toContain(value);
    }
  });

  it("fires bet_builder once for a bet builder run", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await POST_BET_BUILDER(
      new NextRequest("http://localhost/api/bet-builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: "Arsenal BB",
          method: "no_lay",
          stake: 5,
          backOdds: 4,
          selections: [{ label: "Saka to score" }, { label: "Over 2.5" }],
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    expect(captureServerEvent).toHaveBeenCalledWith(
      "user_bet_journey",
      "bet_logged",
      { source: "bet_builder", is_first: false }
    );
  });

  it("does nothing while capture is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_FORCE_ENABLE", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    await logBet();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});
