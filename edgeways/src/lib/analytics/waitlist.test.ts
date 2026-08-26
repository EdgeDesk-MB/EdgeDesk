import { describe, expect, it } from "vitest";
import { waitlistJoinProperties } from "@/lib/analytics/waitlist";

describe("waitlist join properties", () => {
  it("records the form and status without an email", () => {
    expect(
      waitlistJoinProperties({
        formId: "waitlist-hero",
        status: "joined",
      })
    ).toEqual({
      form_id: "waitlist-hero",
      join_status: "joined",
    });
    expect(
      JSON.stringify(
        waitlistJoinProperties({
          formId: "waitlist-footer",
          status: "already_confirmed",
        })
      )
    ).not.toMatch(/@/);
  });
});
