import { describe, expect, it } from "vitest";
import { buildEmailDraft, ingestFromClient, type EmailOfferDraft } from "./email-intake";

const CRLF = "\r\n";
const NOW = new Date("2026-07-16T12:00:00Z");

function eml(subject: string, body: string): string {
  return [
    "From: offers@skybet.com",
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join(CRLF);
}

describe("buildEmailDraft (J6 stage 2 - fetch→draft mapping)", () => {
  it("a bet-and-get promo email maps to a reviewable draft", () => {
    const raw = eml(
      "Bet £10 get £30 in free bets",
      "Place a £10 bet on any football market at odds of evens or bigger\nand we will give you £30 in free bets."
    );
    const d = buildEmailDraft(raw, NOW);
    if (!d) throw new Error("expected draft");
    expect(d.title.length).toBeGreaterThan(3);
    expect(d.title.toLowerCase()).toContain("free bet");
    expect(d.sport).toBe("football");
    expect(d.expectedProfit).toBeGreaterThan(0);
    expect(d.description).toBeTruthy();
  });

  it("non-email content produces no draft", () => {
    expect(buildEmailDraft("just words, no headers", NOW)).toBeNull();
    expect(buildEmailDraft("", NOW)).toBeNull();
  });

  it("an email with an empty body produces no draft", () => {
    const raw = ["Subject: hello", "Content-Type: text/plain", "", "   "].join(CRLF);
    expect(buildEmailDraft(raw, NOW)).toBeNull();
  });
});

describe("ingestFromClient (mock IMAP)", () => {
  it("drafts good messages, marks ONLY those seen, skips the rest", async () => {
    const good = eml("Bet £10 get £30", "Place a £10 bet and get £30 in free bets.");
    const seen: number[][] = [];
    const written: EmailOfferDraft[][] = [];
    const client = {
      listUnseen: async () => [
        { uid: 11, raw: good },
        { uid: 12, raw: "not an email at all" },
      ],
      markSeen: async (uids: number[]) => {
        seen.push(uids);
      },
      close: async () => {},
    };
    const result = await ingestFromClient(client, NOW, (drafts) => {
      written.push(drafts);
      return drafts.length;
    });
    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(seen).toEqual([[11]]); // the unparseable uid 12 stays unseen
    expect(written[0]).toHaveLength(1);
    expect(written[0][0].title.toLowerCase()).toContain("free bet");
  });
});
