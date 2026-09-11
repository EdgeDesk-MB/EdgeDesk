import { describe, expect, it } from "vitest";
import {
  FEEDBACK_PROMPT_DISMISS_MS,
  FEEDBACK_SUBMITTED_SUPPRESS_MS,
  betaFeedbackPromptVisible,
  readPromptTimestamp,
} from "./prompt-shared";

const NOW = 1_800_000_000_000;

const base = {
  pathname: "/",
  signedIn: true,
  demoActive: false,
  dismissedAt: null as number | null,
  submittedAt: null as number | null,
  now: NOW,
};

describe("readPromptTimestamp", () => {
  it("parses a stored epoch ms", () => {
    expect(readPromptTimestamp(String(NOW))).toBe(NOW);
  });

  it("rejects missing, malformed and non-positive values", () => {
    expect(readPromptTimestamp(null)).toBeNull();
    expect(readPromptTimestamp("")).toBeNull();
    expect(readPromptTimestamp("abc")).toBeNull();
    expect(readPromptTimestamp("0")).toBeNull();
    expect(readPromptTimestamp("-5")).toBeNull();
  });
});

describe("betaFeedbackPromptVisible", () => {
  it("shows for a signed-in desk user with no history", () => {
    expect(betaFeedbackPromptVisible(base)).toBe(true);
  });

  it("hides for signed-out visitors and the public demo", () => {
    expect(betaFeedbackPromptVisible({ ...base, signedIn: false })).toBe(false);
    expect(betaFeedbackPromptVisible({ ...base, demoActive: true })).toBe(false);
  });

  it("hides on the feedback page itself", () => {
    expect(betaFeedbackPromptVisible({ ...base, pathname: "/feedback" })).toBe(false);
  });

  it("stays hidden within the dismiss window, then returns", () => {
    const dismissedAt = NOW - FEEDBACK_PROMPT_DISMISS_MS + 1;
    expect(betaFeedbackPromptVisible({ ...base, dismissedAt })).toBe(false);
    expect(
      betaFeedbackPromptVisible({ ...base, dismissedAt: NOW - FEEDBACK_PROMPT_DISMISS_MS })
    ).toBe(true);
  });

  it("stays hidden after submitting feedback, then returns", () => {
    const submittedAt = NOW - FEEDBACK_SUBMITTED_SUPPRESS_MS + 1;
    expect(betaFeedbackPromptVisible({ ...base, submittedAt })).toBe(false);
    expect(
      betaFeedbackPromptVisible({
        ...base,
        submittedAt: NOW - FEEDBACK_SUBMITTED_SUPPRESS_MS,
      })
    ).toBe(true);
  });
});
