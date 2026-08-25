import { describe, expect, it } from "vitest";
import {
  findExistingSetupAccount,
  isSetupConflictError,
  parseSetupDraft,
  setupDraftIsDirty,
  setupDraftStorageKey,
  setupSaveErrorMessage,
} from "@/lib/onboarding-setup-draft";

describe("setup draft", () => {
  it("keys the draft by user and variant", () => {
    expect(setupDraftStorageKey("user_1", "page")).toBe("ew-setup-draft:page:user_1");
    expect(setupDraftStorageKey(null, "dialog")).toBe("ew-setup-draft:dialog");
  });

  it("round-trips a filled page draft", () => {
    const draft = parseSetupDraft({
      v: 1,
      stepId: "bookies",
      bankName: "Monzo",
      bankBalance: "500",
      bookies: [{ name: "Bet365", balance: "40" }],
      stake: "12",
      defaultBookie: "Bet365",
      defaultExchangeName: "Betfair",
      defaultSport: "football",
      appearance: "dark",
      experience: "finder",
      whyHere: ["offers", "unknown_flag"],
      attribution: "reddit",
      attributionOther: "",
      monthlyTarget: 300,
    });
    expect(draft?.stepId).toBe("bookies");
    expect(draft?.bankName).toBe("Monzo");
    expect(draft?.whyHere).toEqual(["offers"]);
    expect(draft?.experience).toBe("finder");
    expect(draft?.monthlyTarget).toBe(300);
  });

  it("rejects a missing version", () => {
    expect(parseSetupDraft({ stepId: "bank" })).toBeNull();
  });

  it("treats answers as dirty once they have started", () => {
    expect(
      setupDraftIsDirty({
        bankName: "",
        bankBalance: "",
        bookies: [{ name: "", balance: "" }],
        experience: null,
        whyHere: [],
        attribution: null,
      })
    ).toBe(false);
    expect(
      setupDraftIsDirty({
        bankName: "Monzo",
        bankBalance: "",
        bookies: [{ name: "", balance: "" }],
        experience: null,
        whyHere: [],
        attribution: null,
      })
    ).toBe(true);
  });
});

describe("setup save helpers", () => {
  it("reuses an existing bank or bookie by name", () => {
    const accounts = [
      { id: 3, name: "Monzo", type: "bank" },
      { id: 9, name: "Bet365", type: "bookie" },
    ];
    expect(findExistingSetupAccount(accounts, "bank", "monzo")).toBe(3);
    expect(findExistingSetupAccount(accounts, "bookie", "Bet365")).toBe(9);
    expect(findExistingSetupAccount(accounts, "bank", "Starling")).toBeNull();
  });

  it("maps conflict and HTTP errors to short copy", () => {
    expect(isSetupConflictError(new Error("409: {\"error\":\"An account with this name already exists\"}"))).toBe(
      true
    );
    expect(setupSaveErrorMessage(new Error("409: already exists"))).toBe(
      "That account is already on the desk."
    );
    expect(setupSaveErrorMessage(new Error("500: {\"error\":\"Could not save set-up answers.\"}"))).toBe(
      "Could not save this step. Try again."
    );
  });
});
