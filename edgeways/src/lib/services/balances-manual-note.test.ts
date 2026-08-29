import { describe, expect, it } from "vitest";
import { historyNoteFromManualTx } from "@/lib/services/balances-manual-note";

describe("historyNoteFromManualTx", () => {
  it("drops default and boilerplate notes", () => {
    expect(historyNoteFromManualTx("adjustment", "adjustment")).toBeNull();
    expect(historyNoteFromManualTx("Opening balance", "top_up")).toBeNull();
    expect(historyNoteFromManualTx("Balance set to £10.00", "adjustment")).toBeNull();
  });

  it("keeps a real note", () => {
    expect(historyNoteFromManualTx("Bank transfer", "top_up")).toBe("Bank transfer");
  });
});
