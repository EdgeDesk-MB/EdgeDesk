/**
 * Resend Receiving API (offer inbox). The email.received webhook carries
 * metadata only - the body comes from this endpoint. Plain fetch with the
 * existing RESEND_API_KEY, same as every other Resend call in the repo.
 */
import "server-only";

export interface ResendReceivedEmail {
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
}

/**
 * Fetch one received email's content. Returns null only when the API key is
 * missing (a config error no retry can fix); HTTP failures throw so the
 * webhook can 500 and let Resend retry delivery.
 */
export async function fetchResendReceivedEmail(
  emailId: string
): Promise<ResendReceivedEmail | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[offer-inbox] RESEND_API_KEY unset. Inbound body fetch skipped.");
    return null;
  }
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) {
    throw new Error(`Resend receiving API responded ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    to: Array.isArray(data.to)
      ? data.to.filter((v): v is string => typeof v === "string")
      : [],
    subject: typeof data.subject === "string" ? data.subject : null,
    text: typeof data.text === "string" ? data.text : null,
    html: typeof data.html === "string" ? data.html : null,
    messageId: typeof data.message_id === "string" ? data.message_id : null,
  };
}
