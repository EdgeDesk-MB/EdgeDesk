import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResendReceivedEmail } from "./resend-receiving";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchResendReceivedEmail", () => {
  it("maps the Receiving API response, snake_case message_id included", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: "email",
          id: "4ef9a417",
          to: ["offers+abc123def45@in.edgeways.app"],
          from: "promos@mail.paddypower.com",
          subject: "Your £10 free bet",
          html: "<p>Place a £10 bet</p>",
          text: null,
          message_id: "<m1@mail.paddypower.com>",
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const email = await fetchResendReceivedEmail("4ef9a417");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails/receiving/4ef9a417",
      { headers: { Authorization: "Bearer re_test_key" } }
    );
    expect(email).toEqual({
      to: ["offers+abc123def45@in.edgeways.app"],
      subject: "Your £10 free bet",
      text: null,
      html: "<p>Place a £10 bet</p>",
      messageId: "<m1@mail.paddypower.com>",
    });
  });

  it("returns null when the API key is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await fetchResendReceivedEmail("4ef9a417")).toBeNull();
  });

  it("throws on HTTP failure so the webhook can 500 and the provider retries", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 502 }))
    );
    await expect(fetchResendReceivedEmail("4ef9a417")).rejects.toThrow("502");
  });
});
