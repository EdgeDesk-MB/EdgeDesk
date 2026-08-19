import { describe, expect, it } from "vitest";
import { requestOrigin } from "@/lib/billing/request-origin";

describe("request origin", () => {
  it("uses the incoming host, not the public marketing URL", () => {
    const request = new Request("http://localhost:3000/subscribe?plan=edge", {
      headers: { host: "localhost:3000" },
    });
    expect(requestOrigin(request)).toBe("http://localhost:3000");
  });

  it("prefers forwarded host and proto on Vercel", () => {
    const request = new Request("http://127.0.0.1/subscribe", {
      headers: {
        host: "127.0.0.1",
        "x-forwarded-host": "edgeways-git-preview.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(requestOrigin(request)).toBe(
      "https://edgeways-git-preview.vercel.app"
    );
  });
});
