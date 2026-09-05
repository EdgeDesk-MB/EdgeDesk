import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractEmailAddresses,
  extractInboxToken,
  extractResendEmailId,
  normaliseInboundPayload,
  synthesiseRawEmail,
  verifySvixSignature,
} from "./inbound-webhook";

function sign(
  secret: string,
  id: string,
  timestamp: string,
  body: string
): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`, "utf8")
    .digest("base64");
  return `v1,${sig}`;
}

const SECRET = `whsec_${Buffer.from("test-secret-key-bytes").toString("base64")}`;
const NOW = Date.parse("2026-09-04T12:00:00Z");

describe("verifySvixSignature", () => {
  const id = "msg_123";
  const timestamp = String(NOW / 1000);
  const body = JSON.stringify({ type: "email.received" });

  it("accepts a correctly signed payload", () => {
    const signature = sign(SECRET, id, timestamp, body);
    expect(
      verifySvixSignature(SECRET, { id, timestamp, signature }, body, NOW)
    ).toBe(true);
  });

  it("accepts when one of several candidates matches", () => {
    const good = sign(SECRET, id, timestamp, body);
    expect(
      verifySvixSignature(
        SECRET,
        { id, timestamp, signature: `v1,bogus ${good}` },
        body,
        NOW
      )
    ).toBe(true);
  });

  it("rejects a tampered body, wrong secret and old timestamps", () => {
    const signature = sign(SECRET, id, timestamp, body);
    expect(
      verifySvixSignature(SECRET, { id, timestamp, signature }, `${body} `, NOW)
    ).toBe(false);
    const wrongSecret = `whsec_${Buffer.from("another-secret").toString("base64")}`;
    expect(
      verifySvixSignature(wrongSecret, { id, timestamp, signature }, body, NOW)
    ).toBe(false);
    const stale = String(NOW / 1000 - 600);
    const staleSig = sign(SECRET, id, stale, body);
    expect(
      verifySvixSignature(SECRET, { id, timestamp: stale, signature: staleSig }, body, NOW)
    ).toBe(false);
  });

  it("rejects missing headers and malformed secrets", () => {
    const signature = sign(SECRET, id, timestamp, body);
    expect(
      verifySvixSignature(SECRET, { id: null, timestamp, signature }, body, NOW)
    ).toBe(false);
    expect(
      verifySvixSignature("", { id, timestamp, signature }, body, NOW)
    ).toBe(false);
  });
});

describe("normaliseInboundPayload", () => {
  it("unwraps the Resend data envelope", () => {
    const result = normaliseInboundPayload({
      type: "email.received",
      data: {
        to: [{ address: "offers+abc123def45@in.edgeways.app" }],
        subject: "Free bet",
        text: "Place a bet",
        html: null,
        message_id: "<m1@mail.paddypower.com>",
      },
    });
    expect(result).toEqual({
      to: ["offers+abc123def45@in.edgeways.app"],
      subject: "Free bet",
      text: "Place a bet",
      html: null,
      messageId: "<m1@mail.paddypower.com>",
    });
  });

  it("reads the Postmark PascalCase shape", () => {
    const result = normaliseInboundPayload({
      To: "Sam <offers+abc123def45@in.edgeways.app>",
      Subject: "Free bet",
      TextBody: "Place a bet",
      HtmlBody: "<p>Place a bet</p>",
      MessageID: "<m2@mail.skybet.com>",
    });
    expect(result?.to).toEqual(["offers+abc123def45@in.edgeways.app"]);
    expect(result?.text).toBe("Place a bet");
    expect(result?.html).toBe("<p>Place a bet</p>");
    expect(result?.messageId).toBe("<m2@mail.skybet.com>");
  });

  it("returns null for payloads with nothing usable", () => {
    expect(normaliseInboundPayload({})).toBeNull();
    expect(normaliseInboundPayload("not an object")).toBeNull();
    expect(normaliseInboundPayload({ data: { unrelated: true } })).toBeNull();
  });

  it("reads the real Resend email.received metadata sample (no body)", () => {
    // Exact shape from Resend's webhook docs: metadata only, body comes
    // from the Receiving API afterwards.
    const result = normaliseInboundPayload({
      type: "email.received",
      created_at: "2026-02-22T23:41:12.126Z",
      data: {
        email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
        created_at: "2026-02-22T23:41:11.894Z",
        from: "onboarding@resend.dev",
        to: ["offers+abc123def45@in.edgeways.app"],
        bcc: [],
        cc: [],
        message_id: "<111-222-333@email.example.com>",
        subject: "Sending this example",
        attachments: [],
      },
    });
    expect(result?.to).toEqual(["offers+abc123def45@in.edgeways.app"]);
    expect(result?.subject).toBe("Sending this example");
    expect(result?.messageId).toBe("<111-222-333@email.example.com>");
    expect(result?.text).toBeNull();
    expect(result?.html).toBeNull();
  });
});

describe("extractResendEmailId", () => {
  it("reads data.email_id from the webhook envelope", () => {
    expect(
      extractResendEmailId({
        type: "email.received",
        data: { email_id: "56761188-7520-42d8-8898-ff6fc54ce618" },
      })
    ).toBe("56761188-7520-42d8-8898-ff6fc54ce618");
  });

  it("falls back to data.id and tolerates junk", () => {
    expect(extractResendEmailId({ data: { id: "abc" } })).toBe("abc");
    expect(extractResendEmailId({})).toBeNull();
    expect(extractResendEmailId(null)).toBeNull();
  });
});

describe("extractEmailAddresses", () => {
  it("pulls addresses out of display-name strings and objects", () => {
    expect(
      extractEmailAddresses('Sam Hayter <offers+abc123def45@in.edgeways.app>')
    ).toEqual(["offers+abc123def45@in.edgeways.app"]);
    expect(
      extractEmailAddresses([
        { address: "offers+abc123def45@in.edgeways.app" },
        "other@example.com",
      ])
    ).toEqual(["offers+abc123def45@in.edgeways.app", "other@example.com"]);
  });
});

describe("extractInboxToken", () => {
  it("accepts the canonical offers+<token> form", () => {
    expect(extractInboxToken(["offers+abc123def45@in.edgeways.app"])).toBe(
      "abc123def45"
    );
  });

  it("accepts a bare token local part (plus-addressing stripped upstream)", () => {
    expect(extractInboxToken(["abc123def45@in.edgeways.app"])).toBe("abc123def45");
  });

  it("ignores addresses that carry no token", () => {
    expect(extractInboxToken(["sam@example.com"])).toBeNull();
    expect(extractInboxToken(["offers+short@in.edgeways.app"])).toBeNull();
    expect(extractInboxToken([])).toBeNull();
  });
});

describe("synthesiseRawEmail", () => {
  it("builds a plain-text MIME message", () => {
    const raw = synthesiseRawEmail({
      subject: "Free bet",
      text: "Place a bet",
      html: null,
      messageId: "<m1@x>",
    });
    expect(raw).toContain("Subject: Free bet");
    expect(raw).toContain("Content-Type: text/plain");
    expect(raw).toContain("Place a bet");
  });

  it("falls back to the html part and says so", () => {
    const raw = synthesiseRawEmail({
      subject: null,
      text: null,
      html: "<p>Place a bet</p>",
      messageId: null,
    });
    expect(raw).toContain("Content-Type: text/html");
    expect(raw).toContain("<p>Place a bet</p>");
  });

  it("strips line breaks from header values (no header injection)", () => {
    const raw = synthesiseRawEmail({
      subject: "Free bet\r\nBcc: attacker@evil.com",
      text: "body",
      html: null,
      messageId: null,
    });
    const headerBlock = raw.slice(0, raw.indexOf("\r\n\r\n"));
    // The injected text survives as harmless subject copy, never as a header.
    expect(headerBlock.split("\r\n").some((line) => line.startsWith("Bcc:"))).toBe(false);
    expect(headerBlock).toContain("Subject: Free bet Bcc: attacker@evil.com");
  });

  it("returns empty when there is no body", () => {
    expect(
      synthesiseRawEmail({ subject: "Hi", text: "  ", html: null, messageId: null })
    ).toBe("");
  });
});
