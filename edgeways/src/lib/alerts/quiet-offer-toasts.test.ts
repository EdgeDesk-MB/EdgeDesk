import { afterEach, describe, expect, it, vi } from "vitest";
import { offerExpiringAlertKeys } from "./expiring-alert-keys";
import { readSeenAlertKeys, resetSeenForTests } from "./seen";
import { EPHEMERAL_ALERT_TOAST_MS, resetAlertToastChannelForTests } from "./local-channel";
import {
  completedKindFromBetType,
  notifyOfferStepDone,
  quietOfferPromptToasts,
} from "./quiet-offer-toasts";

const toastFn = vi.fn();
const toastDismiss = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    dismiss: (...args: unknown[]) => toastDismiss(...args),
  }),
}));

vi.mock("@/lib/document-title", () => ({
  announceAlertDocumentTitle: vi.fn(),
}));

describe("completedKindFromBetType", () => {
  it("maps free-bet types to convert_free_bet", () => {
    expect(completedKindFromBetType("free_snr")).toBe("convert_free_bet");
    expect(completedKindFromBetType("free_sr")).toBe("convert_free_bet");
  });

  it("maps qualifying-style types to place_qualifying", () => {
    expect(completedKindFromBetType("qualifying")).toBe("place_qualifying");
    expect(completedKindFromBetType("risk_free")).toBe("place_qualifying");
    expect(completedKindFromBetType("boost")).toBe("place_qualifying");
  });
});

function stubSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } satisfies Storage);
}

describe("quietOfferPromptToasts", () => {
  afterEach(() => {
    toastFn.mockReset();
    toastDismiss.mockReset();
    resetAlertToastChannelForTests();
    resetSeenForTests();
    vi.unstubAllGlobals();
  });

  it("dismisses sticky tags and suppresses the completed kind plus pre-qualify gates", () => {
    stubSessionStorage();
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const offerId = 5;
    const keys = offerExpiringAlertKeys(offerId);
    const placeKey = keys.find((k) => k.includes("place_qualifying"));
    const optInKey = keys.find((k) => k.includes("playbook_opt_in"));
    const convertKey = keys.find((k) => k.includes("convert_free_bet"));
    expect(placeKey).toBeTruthy();
    expect(optInKey).toBeTruthy();
    expect(convertKey).toBeTruthy();

    quietOfferPromptToasts(offerId, { completedKind: "place_qualifying" });

    for (const key of keys) {
      expect(toastDismiss).toHaveBeenCalledWith(key);
    }

    const seen = readSeenAlertKeys();
    expect(seen.has(placeKey!)).toBe(true);
    expect(seen.has(optInKey!)).toBe(true);
    expect(seen.has(convertKey!)).toBe(false);
  });

  it("suppresses every kind when suppressAll is set", () => {
    stubSessionStorage();
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const offerId = 9;
    const keys = offerExpiringAlertKeys(offerId);
    quietOfferPromptToasts(offerId, { suppressAll: true });

    const seen = readSeenAlertKeys();
    for (const key of keys) {
      expect(seen.has(key)).toBe(true);
    }
  });
});

describe("notifyOfferStepDone", () => {
  afterEach(() => {
    toastFn.mockReset();
    resetAlertToastChannelForTests();
    vi.unstubAllGlobals();
  });

  it("shows an ephemeral positive EdgeAlert toast", () => {
    vi.stubGlobal("Notification", undefined);

    notifyOfferStepDone({
      offerId: 5,
      betId: 42,
      betType: "qualifying",
      bookmaker: "Betfair Sportsbook",
      offerTitle: "Bet £20 get £20 free bet",
    });

    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(toastFn.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        id: "offer_step_done:5:42",
        duration: EPHEMERAL_ALERT_TOAST_MS,
        closeButton: false,
        className: "edge-alert-toast edge-alert-toast--positive",
      })
    );
  });
});
