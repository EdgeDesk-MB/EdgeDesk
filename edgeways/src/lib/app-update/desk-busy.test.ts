import { describe, expect, it } from "vitest";
import { DESK_HOLD_SELECTOR, PAGE_HOLD_VALUE, deskHasOpenHold } from "./desk-busy";

function docMatching(match: (selector: string) => boolean) {
  const seen: string[] = [];
  const doc = {
    querySelector: (selector: string) => {
      seen.push(selector);
      return match(selector) ? {} : null;
    },
  } as unknown as Document;
  return { doc, seen };
}

describe("deskHasOpenHold", () => {
  it("checks every hold when the page stays put", () => {
    const { doc, seen } = docMatching(() => true);
    expect(deskHasOpenHold(doc)).toBe(true);
    expect(seen).toEqual([DESK_HOLD_SELECTOR]);
  });

  it("lets a link to another page past page-scoped holds only", () => {
    const { doc, seen } = docMatching(() => false);
    expect(deskHasOpenHold(doc, true)).toBe(false);
    const selector = seen[0];
    expect(selector).toContain(`[data-update-hold]:not([data-update-hold="${PAGE_HOLD_VALUE}"])`);
    for (const guard of ['[role="dialog"]', '[aria-busy="true"]', "dialog[open]"]) {
      expect(selector).toContain(guard);
    }
  });
});
