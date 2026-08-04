import { describe, expect, it } from "vitest";
import { formatApiError } from "./api-errors";

describe("formatApiError", () => {
  it("translates Zod expiresAt null into plain English", () => {
    const err = new Error(
      `400: {"error":{"formErrors":[],"fieldErrors":{"expiresAt":["Invalid input: expected number, received null"]}}}`
    );
    expect(formatApiError(err)).toMatch(/Expiry is optional/i);
  });

  it("translates required title", () => {
    const err = new Error(
      `400: {"error":{"formErrors":[],"fieldErrors":{"title":["Too small: expected string to have >=1 characters"]}}}`
    );
    expect(formatApiError(err)).toMatch(/Title is required/i);
  });

  it("handles network failures", () => {
    expect(formatApiError(new Error("Failed to fetch"))).toMatch(/Network error/i);
  });
});
