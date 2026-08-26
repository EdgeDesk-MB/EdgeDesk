import { describe, expect, it } from "vitest";
import { ROADMAP_CATEGORIES, ROADMAP_VERSION } from "./roadmap";

const INTERNAL =
  /O1 |P0:|P1:|P2:|P3:|Phase 1|Phase 2|src\/content|backup\/pre-offer|EDGE-\d+|Linear/i;

describe("customer roadmap copy", () => {
  it("does not leak internal ids, git refs, or file paths", () => {
    const blobs = [
      ROADMAP_VERSION.currentLabel,
      ROADMAP_VERSION.targetLabel,
      ROADMAP_VERSION.targetNote,
      ...ROADMAP_CATEGORIES.flatMap((category) =>
        category.items.flatMap((item) => [item.title, item.description ?? ""])
      ),
    ];
    for (const text of blobs) {
      expect(text, text).not.toMatch(INTERNAL);
    }
  });
});
