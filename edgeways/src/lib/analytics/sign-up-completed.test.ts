import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureServerEvent } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
}));
vi.mock("@/lib/analytics/server-capture", () => ({ captureServerEvent }));

import {
  captureSignUpCompleted,
  signUpCompletedProperties,
  signUpMethodFromClerkUser,
} from "@/lib/analytics/sign-up-completed";

describe("signUpMethodFromClerkUser", () => {
  it("maps Clerk providers to a fixed list", () => {
    expect(
      signUpMethodFromClerkUser({ externalAccounts: [{ provider: "oauth_google" }] })
    ).toBe("google");
    expect(
      signUpMethodFromClerkUser({ externalAccounts: [{ provider: "google" }] })
    ).toBe("google");
    expect(
      signUpMethodFromClerkUser({ externalAccounts: [{ provider: "oauth_apple" }] })
    ).toBe("apple");
    expect(
      signUpMethodFromClerkUser({ externalAccounts: [{ provider: "oauth_discord" }] })
    ).toBe("other");
    expect(
      signUpMethodFromClerkUser({
        externalAccounts: [],
        emailAddresses: [{ emailAddress: "sam@example.com" }],
      })
    ).toBe("email");
    expect(signUpMethodFromClerkUser({})).toBe("unknown");
    expect(signUpMethodFromClerkUser(null)).toBe("unknown");
  });
});

describe("sign_up_completed", () => {
  beforeEach(() => captureServerEvent.mockClear());

  it("sends only the method", () => {
    expect(signUpCompletedProperties("google")).toEqual({ method: "google" });
    expect(signUpCompletedProperties(undefined)).toEqual({ method: "unknown" });
  });

  it("captures once against the Clerk id with no personal data", () => {
    captureSignUpCompleted({
      clerkUserId: "user_abc",
      method: signUpMethodFromClerkUser({
        emailAddresses: [{ emailAddress: "sam@example.com" }],
      }),
    });
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    expect(captureServerEvent).toHaveBeenCalledWith(
      "user_abc",
      "sign_up_completed",
      { method: "email" }
    );
    expect(JSON.stringify(captureServerEvent.mock.calls[0]![2])).not.toMatch(/@/);
  });
});
