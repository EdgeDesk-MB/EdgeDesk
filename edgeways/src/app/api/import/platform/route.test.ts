import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/import/platform/route";
import { db, bets } from "@/lib/db";
import { parseOddsmonkeyProfits } from "@/lib/import/oddsmonkey-profits";

const fixture = readFileSync(
  path.resolve(process.cwd(), "../docs/strategy/fixtures/oddsmonkey-profits-sample.csv"),
  "utf8"
);

async function importDrafts(drafts: unknown) {
  const request = new NextRequest("http://localhost/api/import/platform", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ drafts }),
  });
  return POST(request);
}

describe("platform import API", () => {
  it("inserts Oddsmonkey history once, then skips the same fingerprints", async () => {
    const { drafts } = parseOddsmonkeyProfits(fixture);
    expect(drafts.length).toBe(2);

    const first = await importDrafts(drafts);
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { inserted: number; skipped: number };
    expect(firstBody.inserted).toBe(2);
    expect(firstBody.skipped).toBe(0);

    const stored = db
      .select()
      .from(bets)
      .where(eq(bets.importFingerprint, drafts[0]!.fingerprint))
      .all();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.source).toBe("import");
    expect(stored[0]!.backStake).toBe(0);
    expect(stored[0]!.notes).toContain("Imported from Oddsmonkey");

    const second = await importDrafts(drafts);
    const secondBody = (await second.json()) as { inserted: number; skipped: number };
    expect(secondBody.inserted).toBe(0);
    expect(secondBody.skipped).toBe(2);
  });
});
