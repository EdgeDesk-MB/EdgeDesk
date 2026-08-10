import { describe, expect, it } from "vitest";
import { joinDatetimeLocal, splitDatetimeLocal } from "@/components/date-time-picker";

describe("splitDatetimeLocal / joinDatetimeLocal", () => {
  it("splits datetime-local into date and HH:mm", () => {
    expect(splitDatetimeLocal("2026-08-05T22:27")).toEqual({
      date: "2026-08-05",
      time: "22:27",
    });
  });

  it("handles empty and date-only", () => {
    expect(splitDatetimeLocal("")).toEqual({ date: "", time: "" });
    expect(splitDatetimeLocal("2026-08-05")).toEqual({
      date: "2026-08-05",
      time: "",
    });
  });

  it("joins date + time, defaulting time when blank", () => {
    expect(joinDatetimeLocal("2026-08-05", "22:27")).toBe("2026-08-05T22:27");
    expect(joinDatetimeLocal("2026-08-05", "")).toBe("2026-08-05T12:00");
    expect(joinDatetimeLocal("", "22:27")).toBe("");
  });
});
