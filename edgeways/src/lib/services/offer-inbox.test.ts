import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  offerInboxAddresses,
  offerInboundMessages,
  offers,
} from "@/lib/db";
import {
  disableOfferInbox,
  enableOfferInbox,
  formatInboxAddress,
  generateInboxToken,
  getOfferInboxStatus,
  INBOUND_DAILY_CAP,
  INBOUND_LEDGER_RETENTION_MS,
  ingestInboundEmail,
  isOfferInboxAllowed,
  rotateOfferInbox,
  sendTestForward,
} from "./offer-inbox";

const GOOD_EMAIL = {
  subject: "Bet £10 get £30 in free bets",
  text: "Place a £10 bet on any football market at odds of evens or bigger\nand we will give you £30 in free bets.",
  html: null,
};

function localToken(): string {
  const row = db.select().from(offerInboxAddresses).limit(1).get();
  if (!row) throw new Error("inbox not enabled");
  return row.token;
}

function offerCount(): number {
  return db.select().from(offers).all().length;
}

beforeEach(() => {
  db.delete(offerInboundMessages).run();
  db.delete(offerInboxAddresses).run();
  db.delete(offers).run();
});

describe("address lifecycle (local desk)", () => {
  it("is off by default and enabling creates a unique address", async () => {
    const before = await getOfferInboxStatus();
    expect(before.enabled).toBe(false);
    expect(before.address).toBeNull();

    const after = await enableOfferInbox();
    expect(after.enabled).toBe(true);
    expect(after.address).toMatch(/^offers\+[a-z2-9]{12}@in\.edgeways\.app$/);
  });

  it("enabling twice keeps the same address", async () => {
    const first = await enableOfferInbox();
    const second = await enableOfferInbox();
    expect(second.address).toBe(first.address);
  });

  it("rotate swaps the token and the old address stops routing", async () => {
    const first = await enableOfferInbox();
    const rotated = await rotateOfferInbox();
    expect(rotated.address).not.toBe(first.address);

    const oldToken = first.address!.split("@")[0].replace("offers+", "");
    const result = await ingestInboundEmail({
      token: oldToken,
      ...GOOD_EMAIL,
      messageId: "<old@x>",
    });
    expect(result.status).toBe("unknown_address");
    expect(offerCount()).toBe(0);
  });

  it("disable removes the address", async () => {
    await enableOfferInbox();
    const off = await disableOfferInbox();
    expect(off.enabled).toBe(false);
    expect(off.address).toBeNull();
  });

  it("tokens are 12-char lowercase and addresses use the inbox domain", () => {
    expect(generateInboxToken()).toMatch(/^[a-z2-9]{12}$/);
    expect(formatInboxAddress("abc123def45")).toBe(
      "offers+abc123def45@in.edgeways.app"
    );
  });
});

describe("ingestInboundEmail (local desk)", () => {
  it("drafts a Planned offer tagged source 'email' and notifies", async () => {
    await enableOfferInbox();
    const result = await ingestInboundEmail({
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<m1@mail.skybet.com>",
    });
    expect(result.status).toBe("drafted");
    expect(result.offerId).toBeDefined();

    const row = db
      .select()
      .from(offers)
      .where(eq(offers.id, result.offerId!))
      .get()!;
    expect(row.status).toBe("planned");
    expect(row.source).toBe("email");
    expect(row.title.toLowerCase()).toContain("free bet");

    const ledger = db.select().from(offerInboundMessages).all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].status).toBe("drafted");
    expect(ledger[0].offerId).toBe(result.offerId);
  });

  it("dedupes a retried delivery by provider message id", async () => {
    await enableOfferInbox();
    const input = {
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<m1@mail.skybet.com>",
    };
    const first = await ingestInboundEmail(input);
    const second = await ingestInboundEmail(input);
    expect(first.status).toBe("drafted");
    expect(second.status).toBe("duplicate");
    expect(offerCount()).toBe(1);
  });

  it("dedupes a re-forwarded campaign by content fingerprint", async () => {
    await enableOfferInbox();
    const first = await ingestInboundEmail({
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<m1@mail.skybet.com>",
    });
    const second = await ingestInboundEmail({
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<m2@mail.skybet.com>", // different id, same campaign
    });
    expect(first.status).toBe("drafted");
    expect(second.status).toBe("duplicate");
    expect(offerCount()).toBe(1);
  });

  it("an unparseable email is recorded as failed, never as an offer", async () => {
    await enableOfferInbox();
    const result = await ingestInboundEmail({
      token: localToken(),
      subject: "Your account statement",
      text: "   ",
      html: null,
      messageId: "<m3@mail.skybet.com>",
    });
    expect(result.status).toBe("failed");
    expect(offerCount()).toBe(0);
    const ledger = db.select().from(offerInboundMessages).all();
    expect(ledger[0].status).toBe("failed");
  });

  it("unknown tokens are silently dropped", async () => {
    await enableOfferInbox();
    const result = await ingestInboundEmail({
      token: "not-a-real-token",
      ...GOOD_EMAIL,
      messageId: "<m4@x>",
    });
    expect(result.status).toBe("unknown_address");
    expect(offerCount()).toBe(0);
    expect(db.select().from(offerInboundMessages).all()).toHaveLength(0);
  });

  it("caps intake at the daily limit", async () => {
    await enableOfferInbox();
    const addressId = db.select().from(offerInboxAddresses).get()!.id;
    for (let i = 0; i < INBOUND_DAILY_CAP; i++) {
      db.insert(offerInboundMessages)
        .values({
          addressId,
          messageId: `<flood-${i}@x>`,
          fingerprint: `f${i}`,
          status: "drafted",
          offerId: null,
          createdAt: Date.now(),
        })
        .run();
    }
    const result = await ingestInboundEmail({
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<over-cap@x>",
    });
    expect(result.status).toBe("rate_limited");
    expect(offerCount()).toBe(0);
  });

  it("prunes receipt log rows older than the retention window on ingest", async () => {
    await enableOfferInbox();
    const addressId = db.select().from(offerInboxAddresses).get()!.id;
    const stale = Date.now() - INBOUND_LEDGER_RETENTION_MS - 60_000;
    db.insert(offerInboundMessages)
      .values({
        addressId,
        messageId: "<ancient@x>",
        fingerprint: "stale",
        status: "drafted",
        offerId: null,
        createdAt: stale,
      })
      .run();

    const result = await ingestInboundEmail({
      token: localToken(),
      ...GOOD_EMAIL,
      messageId: "<fresh@x>",
    });
    expect(result.status).toBe("drafted");
    const ledger = db.select().from(offerInboundMessages).all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].messageId).toBe("<fresh@x>");
  });

  it("sendTestForward bypasses dedup so repeat tests always land", async () => {
    await enableOfferInbox();
    const first = await sendTestForward();
    const second = await sendTestForward();
    expect(first.status).toBe("drafted");
    expect(second.status).toBe("drafted");
    expect(offerCount()).toBe(2);
  });

  it("sendTestForward refuses while the inbox is off", async () => {
    await expect(sendTestForward()).rejects.toThrow("Turn on your offer inbox");
  });
});

describe("rollout gate", () => {
  it("is always on for the local desk", async () => {
    expect(await isOfferInboxAllowed("u_plain")).toBe(true);
    expect(await isOfferInboxAllowed("u_missing")).toBe(true);
  });
});
