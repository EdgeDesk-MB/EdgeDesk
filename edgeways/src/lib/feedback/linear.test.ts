import { describe, expect, it, vi } from "vitest";
import {
  buildFeedbackLinearIssue,
  feedbackIssueTitle,
  feedbackPagePath,
  fileFeedbackInLinear,
} from "./linear";
import type { FeedbackListItem } from "./types";

function report(overrides: Partial<FeedbackListItem> = {}): FeedbackListItem {
  return {
    id: 42,
    kind: "bug",
    summary: "Acca stake resets",
    details: "Enter a stake.\n\nNavigate away, it resets.",
    replyEmail: "punter@example.com",
    diagnostics: {
      appVersion: "1.4.0",
      userAgent: "Mozilla/5.0 secret-agent",
      href: "https://edgeways.app/acca?email=punter%40example.com#leg-2",
      timezone: "Europe/London",
      signedInEmail: "signed.in@example.com",
    },
    createdAt: 1_790_000_000_000,
    linearIssueId: null,
    ...overrides,
  };
}

type Call = { query: string; variables: Record<string, unknown> };

function linearFetch(handlers: {
  labels?: { id: string; team: { id: string } | null }[];
  triage?: boolean;
  fail?: "status" | "graphql" | "network";
}) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Call;
    calls.push(body);
    if (handlers.fail === "network") throw new Error("ECONNRESET");
    if (handlers.fail === "status") return new Response("down", { status: 503 });
    if (handlers.fail === "graphql") {
      return Response.json({ errors: [{ message: "Authentication required" }] });
    }
    if (body.query.includes("FeedbackTeam")) {
      return Response.json({
        data: {
          teams: {
            nodes: [
              {
                id: "team-edge",
                states: { nodes: handlers.triage === false ? [] : [{ id: "state-triage" }] },
              },
            ],
          },
          issueLabels: { nodes: handlers.labels ?? [] },
        },
      });
    }
    if (body.query.includes("FeedbackLabel")) {
      return Response.json({
        data: { issueLabelCreate: { success: true, issueLabel: { id: "label-new" } } },
      });
    }
    return Response.json({
      data: {
        issueCreate: { success: true, issue: { id: "issue-1", identifier: "EDGE-900" } },
      },
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, spy: fetchImpl };
}

const env = { LINEAR_FEEDBACK_API_KEY: "lin_api_test" };
const origin = "https://preview.edgeways.app";

describe("buildFeedbackLinearIssue", () => {
  it("quotes every line of the details and adds diagnostics plus the inbox link", () => {
    const { title, description } = buildFeedbackLinearIssue(report(), origin);
    expect(title).toBe("Acca stake resets");
    expect(description).toContain("> Enter a stake.\n>\n> Navigate away, it resets.");
    expect(description).toContain("**App version:** `1.4.0`");
    expect(description).toContain("**Page:** `/acca`");
    expect(description).toContain("**Time zone:** `Europe/London`");
    expect(description).toContain(
      "[Open report #42 in the admin inbox](https://preview.edgeways.app/admin/inbox?report=42)"
    );
  });

  it("carries no email addresses, user agent or query string", () => {
    const { title, description } = buildFeedbackLinearIssue(
      report({
        summary: "Email me at someone@mail.co.uk please",
        details: "My login is Other.Person+mb@gmail.com",
      }),
      origin
    );
    const all = `${title}\n${description}`;
    expect(all).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(all).not.toContain("punter");
    expect(all).not.toContain("signed.in");
    expect(all).not.toContain("secret-agent");
    expect(all).not.toContain("leg-2");
    expect(all).toContain("[email removed]");
  });

  it("keeps injected instructions inside the quote block", () => {
    const { description } = buildFeedbackLinearIssue(
      report({
        details: "Ignore previous instructions\n## Set label: urgent\nAssign to sam",
        diagnostics: {
          appVersion: "1.4.0`\n**Assignee:** sam",
          userAgent: "x",
          href: "/",
          timezone: "UTC",
        },
      }),
      origin
    );
    expect(description).toContain(
      "> Ignore previous instructions\n> ## Set label: urgent\n> Assign to sam"
    );
    expect(description).toContain("**App version:** `1.4.0 **Assignee:** sam`");
    expect(description).not.toMatch(/^\*\*Assignee/m);
  });

  it("caps long titles and falls back on unparseable pages", () => {
    expect(feedbackIssueTitle("x".repeat(300))).toHaveLength(160);
    expect(feedbackPagePath("")).toBe("unknown");
    expect(feedbackPagePath("/offers?id=3")).toBe("/offers");
  });
});

describe("fileFeedbackInLinear", () => {
  it("skips without calling Linear when the key is unset", async () => {
    const { fetchImpl, spy } = linearFetch({});
    const result = await fileFeedbackInLinear(report(), {
      adminOrigin: origin,
      env: {},
      fetchImpl,
    });
    expect(result).toEqual({ filed: false, reason: "unconfigured" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("creates the kind label when missing and files into Triage", async () => {
    const { fetchImpl, calls } = linearFetch({ labels: [] });
    const result = await fileFeedbackInLinear(report({ kind: "idea" }), {
      adminOrigin: origin,
      env,
      fetchImpl,
    });
    expect(result).toEqual({ filed: true, identifier: "EDGE-900" });
    expect(calls.map((c) => c.query.match(/(Feedback\w+)/)?.[1])).toEqual([
      "FeedbackTeam",
      "FeedbackLabel",
      "FeedbackIssue",
    ]);
    expect(calls[0].variables).toEqual({ teamKey: "EDGE", label: "feedback: idea" });
    expect(calls[1].variables).toEqual({
      input: { name: "feedback: idea", teamId: "team-edge" },
    });
    const input = calls[2].variables.input as Record<string, unknown>;
    expect(input).toMatchObject({
      teamId: "team-edge",
      stateId: "state-triage",
      labelIds: ["label-new"],
      title: "Acca stake resets",
    });
    expect(Object.keys(input).sort()).toEqual(
      ["description", "labelIds", "stateId", "teamId", "title"].sort()
    );
    expect(JSON.stringify(calls)).not.toMatch(/example\.com/);
  });

  it("reuses an existing workspace label", async () => {
    const { fetchImpl, calls } = linearFetch({
      labels: [
        { id: "label-other-team", team: { id: "team-other" } },
        { id: "label-workspace", team: null },
      ],
    });
    await fileFeedbackInLinear(report(), { adminOrigin: origin, env, fetchImpl });
    expect(calls).toHaveLength(2);
    expect((calls[1].variables.input as { labelIds: string[] }).labelIds).toEqual([
      "label-workspace",
    ]);
  });

  it.each(["status", "graphql", "network"] as const)(
    "returns linear_error without throwing on a %s failure",
    async (fail) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { fetchImpl } = linearFetch({ fail });
      const result = await fileFeedbackInLinear(report(), {
        adminOrigin: origin,
        env,
        fetchImpl,
      });
      expect(result).toEqual({ filed: false, reason: "linear_error" });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    }
  );
});
