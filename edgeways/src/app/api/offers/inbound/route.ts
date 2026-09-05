import { NextResponse } from "next/server";
import {
  extractInboxToken,
  extractResendEmailId,
  normaliseInboundPayload,
  verifySvixSignature,
  type NormalisedInboundEmail,
} from "@/lib/services/inbound-webhook";
import { ingestInboundEmail } from "@/lib/services/offer-inbox";
import { fetchResendReceivedEmail } from "@/lib/services/resend-receiving";

export const dynamic = "force-dynamic";

/**
 * Inbound email webhook (offer inbox). The provider POSTs each email sent
 * to a desk's offers+<token>@ address here.
 *
 * Auth is the svix signature over the raw body (EDGEWAYS_INBOUND_WEBHOOK_SECRET),
 * never the desk session - there is no signed-in user on this request. With
 * no secret configured the endpoint only answers in development, so a
 * production deploy without the secret fails closed (503) rather than
 * accepting unauthenticated email.
 *
 * Terminal states return 200 even for unknown tokens, duplicates and parse
 * failures: providers retry non-2xx, and a retry cannot change those
 * outcomes. Response bodies carry metadata only, never email content.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.EDGEWAYS_INBOUND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const valid = verifySvixSignature(
      secret,
      {
        id: req.headers.get("svix-id"),
        timestamp: req.headers.get("svix-timestamp"),
        signature: req.headers.get("svix-signature"),
      },
      rawBody
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Inbound email is not configured" },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normaliseInboundPayload(payload);
  if (!email) {
    return NextResponse.json({ status: "ignored" });
  }
  const token = extractInboxToken(email.to);
  if (!token) {
    // Not addressed to a desk inbox (e.g. catch-all noise). Silent drop.
    return NextResponse.json({ status: "ignored" });
  }

  // Resend's email.received webhook is metadata only: fetch the body from
  // the Receiving API. A fetch failure throws → 500 → Resend retries.
  let full: NormalisedInboundEmail = email;
  if (!full.text && !full.html) {
    const emailId = extractResendEmailId(payload);
    if (emailId) {
      const fetched = await fetchResendReceivedEmail(emailId);
      if (fetched) {
        full = {
          to: fetched.to.length > 0 ? fetched.to : email.to,
          subject: fetched.subject ?? email.subject,
          text: fetched.text,
          html: fetched.html,
          messageId: fetched.messageId ?? email.messageId,
        };
      }
    }
  }

  try {
    const result = await ingestInboundEmail({
      token,
      subject: full.subject,
      text: full.text,
      html: full.html,
      messageId: full.messageId,
    });
    return NextResponse.json({ status: result.status });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
