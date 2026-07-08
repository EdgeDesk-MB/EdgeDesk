import { describe, expect, it } from "vitest";
import { matchOcrToRunner } from "./match-runner";

describe("matchOcrToRunner", () => {
  const runners = ["Constitution Hill", "State Man", "Galopin Des Champs"];

  it("matches exact horse name", () => {
    expect(matchOcrToRunner("Constitution Hill", runners)?.runner).toBe("Constitution Hill");
  });

  it("matches partial OCR text", () => {
    expect(matchOcrToRunner("State Man", runners)?.confidence).toBe("high");
  });

  it("returns null for unrelated text", () => {
    expect(matchOcrToRunner("Random Horse XYZ", runners)).toBeNull();
  });
});
