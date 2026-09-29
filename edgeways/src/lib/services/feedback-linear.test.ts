import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feedback/notify", () => ({
  notifyFeedbackInbox: vi.fn(async () => ({ sent: true })),
}));
vi.mock("@/lib/feedback/customer-context", () => ({
  loadFeedbackCustomerContext: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics/server-capture", () => ({
  captureServerEvent: vi.fn(),
}));

import { listFeedbackReports, submitFeedback } from "./feedback";

const input = {
  kind: "bug" as const,
  summary: "Offer card double counts",
  details: "Profit shows twice on the card.",
  replyEmail: "punter@example.com",
  signedInEmail: "punter@example.com",
  adminOrigin: "https://preview.edgeways.app",
  diagnostics: {
    appVersion: "1.4.0",
    userAgent: "vitest",
    href: "https://preview.edgeways.app/offers",
    timezone: "Europe/London",
  },
};

function linearOk(identifier: string) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { query } = JSON.parse(String(init?.body)) as { query: string };
    if (query.includes("FeedbackTeam")) {
      return Response.json({
        data: {
          teams: { nodes: [{ id: "team", states: { nodes: [{ id: "triage" }] } }] },
          issueLabels: { nodes: [{ id: "label", team: null }] },
        },
      });
    }
    return Response.json({
      data: { issueCreate: { success: true, issue: { id: "i", identifier } } },
    });
  });
}

describe("submitFeedback Linear filing", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores the Linear issue key on the report", async () => {
    vi.stubEnv("LINEAR_FEEDBACK_API_KEY", "lin_api_test");
    const fetchSpy = linearOk("EDGE-901");
    vi.stubGlobal("fetch", fetchSpy);

    const { report, emailed } = await submitFeedback(input);

    expect(emailed).toBe(true);
    expect(report?.linearIssueId).toBe("EDGE-901");
    const stored = (await listFeedbackReports(100)).find((r) => r.id === report?.id);
    expect(stored?.linearIssueId).toBe("EDGE-901");
    const sent = fetchSpy.mock.calls.map(([, init]) => String(init?.body)).join("\n");
    expect(sent).not.toContain("punter");
    expect(sent).toContain(`admin/inbox?report=${report?.id}`);
  });

  it("still saves and succeeds when Linear is down", async () => {
    vi.stubEnv("LINEAR_FEEDBACK_API_KEY", "lin_api_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );

    const { report, emailed } = await submitFeedback(input);

    expect(emailed).toBe(true);
    expect(report?.id).toBeGreaterThan(0);
    expect(report?.linearIssueId).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("skips Linear when the key is unset", async () => {
    vi.stubEnv("LINEAR_FEEDBACK_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { report } = await submitFeedback(input);

    expect(report?.linearIssueId).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
