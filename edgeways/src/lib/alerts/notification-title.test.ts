import { describe, expect, it } from "vitest";
import { ensureNotificationTitleEmoji } from "./notification-title";

describe("ensureNotificationTitleEmoji", () => {
  it("keeps a single brand bolt on offer titles", () => {
    expect(ensureNotificationTitleEmoji("⚡ £4 edge · Galway starts in 15 minutes")).toBe(
      "⚡ £4 edge · Galway starts in 15 minutes"
    );
  });

  it("collapses stacked brand bolts from push + title", () => {
    expect(ensureNotificationTitleEmoji("⚡ ⚡ £4 edge · Galway starts in 15 minutes")).toBe(
      "⚡ £4 edge · Galway starts in 15 minutes"
    );
  });

  it("keeps semantic settlement / race / exposure emojis", () => {
    expect(ensureNotificationTitleEmoji("🟢 +£4.10 settled")).toBe("🟢 +£4.10 settled");
    expect(ensureNotificationTitleEmoji("You just made £4.10")).toBe(
      "⚡ You just made £4.10"
    );
    expect(ensureNotificationTitleEmoji("🔴 -£1.51 settled")).toBe("🔴 -£1.51 settled");
    expect(ensureNotificationTitleEmoji("⏰ Ascot off in 12 minutes")).toBe(
      "⏰ Ascot off in 12 minutes"
    );
    expect(ensureNotificationTitleEmoji("⚠️ Lay missing · full stake exposed")).toBe(
      "⚠️ Lay missing · full stake exposed"
    );
    expect(ensureNotificationTitleEmoji("🔒 2UP · lock £11.29")).toBe(
      "🔒 2UP · lock £11.29"
    );
  });

  it("strips a brand bolt stacked in front of a semantic emoji", () => {
    expect(ensureNotificationTitleEmoji("⚡ 🟢 +£4.10 settled")).toBe("🟢 +£4.10 settled");
    expect(ensureNotificationTitleEmoji("⚡ You just made £4.10")).toBe(
      "⚡ You just made £4.10"
    );
  });

  it("adds a brand bolt when the title has none", () => {
    expect(ensureNotificationTitleEmoji("Reminder · Bet365 · Free spins")).toBe(
      "⚡ Reminder · Bet365 · Free spins"
    );
    expect(ensureNotificationTitleEmoji("Void · stakes returned")).toBe(
      "⚡ Void · stakes returned"
    );
  });

  it("falls back when empty", () => {
    expect(ensureNotificationTitleEmoji("")).toBe("⚡ edgeways");
    expect(ensureNotificationTitleEmoji("⚡")).toBe("⚡ edgeways");
  });
});
