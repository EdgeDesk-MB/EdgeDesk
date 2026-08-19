import { describe, expect, it } from "vitest";
import {
  buildWaitlistThanksEmail,
  confirmWaitlist,
  isValidWaitlistEmail,
  isWaitlistFoundingEligible,
  joinWaitlist,
  normaliseWaitlistEmail,
  unsubscribeWaitlist,
} from "@/lib/services/waitlist";
import { db, waitlistSignups } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("waitlist email helpers", () => {
  it("normalises and validates", () => {
    expect(normaliseWaitlistEmail("  Sam@Edgeways.app ")).toBe("sam@edgeways.app");
    expect(isValidWaitlistEmail("sam@edgeways.app")).toBe(true);
    expect(isValidWaitlistEmail("nope")).toBe(false);
  });

  it("builds a branded thanks email with RG and unsubscribe", () => {
    const mail = buildWaitlistThanksEmail({
      origin: "https://www.edgeways.app",
      unsubscribeUrl: "https://www.edgeways.app/api/waitlist/unsubscribe?token=abc",
    });
    expect(mail.subject).toMatch(/waitlist/i);
    expect(mail.html).toContain("https://www.edgeways.app/");
    expect(mail.html).toContain("edgeways");
    expect(mail.html).not.toContain("cid:");
    expect(mail.html).toContain("BeGambleAware.org");
    expect(mail.html).toContain("Back to site");
    expect(mail.html).toContain("#222222");
    expect(mail.text).toContain("Unsubscribe:");
  });
});

describe("joinWaitlist + unsubscribeWaitlist", () => {
  it("stores the email as confirmed and supports unsubscribe", async () => {
    const email = `waitlist-${Date.now()}@example.com`;

    const joined = await joinWaitlist(email);
    expect(joined).toEqual({ status: "joined", email });

    const row = db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .get();
    expect(row?.confirmedAt).toBeTypeOf("number");
    expect(row?.unsubscribedAt).toBeNull();
    expect(row?.confirmTokenHash).toBeTruthy();
    expect(await isWaitlistFoundingEligible(email)).toBe(true);
    expect(await isWaitlistFoundingEligible(` ${email.toUpperCase()} `)).toBe(
      true
    );
    expect(await isWaitlistFoundingEligible("nobody@example.com")).toBe(false);

    expect(await confirmWaitlist("not-a-real-token")).toEqual({
      status: "invalid_token",
    });
    expect(await unsubscribeWaitlist("not-a-real-token")).toEqual({
      status: "invalid_token",
    });

    const again = await joinWaitlist(email);
    expect(again).toEqual({ status: "already_confirmed", email });
  });

  it("unsubscribes via the list token and allows re-join", async () => {
    const email = `waitlist-unsub-${Date.now()}@example.com`;
    await joinWaitlist(email);

    const row = db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .get();
    expect(row).toBeTruthy();

    const { createHash, randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.update(waitlistSignups)
      .set({ confirmTokenHash: tokenHash })
      .where(eq(waitlistSignups.email, email))
      .run();

    const unsub = await unsubscribeWaitlist(token);
    expect(unsub).toEqual({ status: "unsubscribed", email });

    const after = db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .get();
    expect(after?.unsubscribedAt).toBeTypeOf("number");
    expect(await isWaitlistFoundingEligible(email)).toBe(false);

    expect(await unsubscribeWaitlist(token)).toEqual({
      status: "already_unsubscribed",
      email,
    });

    const rejoined = await joinWaitlist(email);
    expect(rejoined).toEqual({ status: "joined", email });
    const restored = db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .get();
    expect(restored?.unsubscribedAt).toBeNull();
  });
});
