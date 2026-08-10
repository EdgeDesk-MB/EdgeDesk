import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import {
  createLocalAlertChannel,
  dismissStaleStickyAlertToasts,
  edgeAlertToastOptions,
  EPHEMERAL_ALERT_TOAST_MS,
  resetAlertToastChannelForTests,
} from "./local-channel";
import { ALERT_TOAST_STALE_DISMISS_MS } from "./toast-age";
import type { EdgeAlert } from "./types";

const toastFn = vi.fn();
const toastDismiss = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    dismiss: (...args: unknown[]) => toastDismiss(...args),
  }),
}));

const sampleAlert: EdgeAlert = {
  key: "result_settled:42",
  kind: "result_settled",
  title: "You just made £4.10",
  body: "Qualifying · Weekend accumulator",
  bookmaker: "Bet365",
  href: "/tracker?bet=42",
};

describe("edgeAlertToastOptions", () => {
  it("keeps OnEvent toasts on-page until dismissed, without an Open CTA", () => {
    const opts = edgeAlertToastOptions(sampleAlert);
    expect(opts.id).toBe("result_settled:42");
    expect(opts.duration).toBe(Number.POSITIVE_INFINITY);
    expect(opts.closeButton).toBe(true);
    expect(opts.description).toBeTruthy();
    expect(opts.action).toBeUndefined();
  });

  it("uses the default toast face with brand-accent class hooks", () => {
    const opts = edgeAlertToastOptions(sampleAlert);
    expect(opts.className).toBe("edge-alert-toast");
    expect(opts.classNames.closeButton).toBe("edge-alert-toast-close");
  });

  it("makes user-action toasts auto-dismiss without a close control", () => {
    const opts = edgeAlertToastOptions({ ...sampleAlert, delivery: "ephemeral" });
    expect(opts.duration).toBe(EPHEMERAL_ALERT_TOAST_MS);
    expect(opts.closeButton).toBe(false);
    expect(opts.classNames.closeButton).toBeUndefined();
  });
});

describe("createLocalAlertChannel", () => {
  afterEach(() => {
    toastFn.mockReset();
    toastDismiss.mockReset();
    resetAlertToastChannelForTests();
    vi.unstubAllGlobals();
  });

  it("always shows a sticky default toast, even when browser notifications are granted", () => {
    const NotificationMock = vi.fn(function NotificationMock() {
      return { onclick: null, close: vi.fn() };
    }) as unknown as typeof Notification;
    Object.defineProperty(NotificationMock, "permission", {
      value: "granted",
      configurable: true,
    });
    vi.stubGlobal("Notification", NotificationMock);
    // No serviceWorker key → page Notification path (toast still always fires).
    vi.stubGlobal("navigator", {});

    const channel = createLocalAlertChannel();
    channel.notify(sampleAlert);

    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(toastFn.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        id: sampleAlert.key,
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
        className: "edge-alert-toast",
      })
    );
    expect(NotificationMock).toHaveBeenCalled();
  });

  it("shows a sticky toast when notifications are unavailable", () => {
    vi.stubGlobal("Notification", undefined);

    const channel = createLocalAlertChannel();
    channel.notify({
      ...sampleAlert,
      key: "two_up_lock:7",
      kind: "two_up_lock",
      title: "2UP triggered",
      tone: null,
    });

    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(toastFn.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
        className: "edge-alert-toast",
      })
    );
  });

  it("skips OS notifications for ephemeral user-action toasts", () => {
    const NotificationMock = vi.fn(function NotificationMock() {
      return { onclick: null, close: vi.fn() };
    }) as unknown as typeof Notification;
    Object.defineProperty(NotificationMock, "permission", {
      value: "granted",
      configurable: true,
    });
    vi.stubGlobal("Notification", NotificationMock);
    vi.stubGlobal("navigator", {});

    const channel = createLocalAlertChannel();
    channel.notify({ ...sampleAlert, delivery: "ephemeral" });

    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(toastFn.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        duration: EPHEMERAL_ALERT_TOAST_MS,
        closeButton: false,
      })
    );
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it("adds polarity classes for win and loss settlements", () => {
    vi.stubGlobal("Notification", undefined);
    const channel = createLocalAlertChannel();
    channel.notify({ ...sampleAlert, tone: "positive" });
    channel.notify({
      ...sampleAlert,
      key: "result_settled:43",
      title: "-£1.51 settled",
      tone: "negative",
    });
    expect(toastFn.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        className: "edge-alert-toast edge-alert-toast--positive",
      })
    );
    expect(toastFn.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        className: "edge-alert-toast edge-alert-toast--negative",
      })
    );
  });

  it("uses a React description for sticky toasts so age can render", () => {
    vi.stubGlobal("Notification", undefined);
    const channel = createLocalAlertChannel();
    channel.notify(sampleAlert);
    const opts = toastFn.mock.calls[0]?.[1] as { description?: unknown };
    expect(isValidElement(opts.description)).toBe(true);
  });

  it("refreshes sticky toast copy in place without a second OS notify", () => {
    const NotificationMock = vi.fn(function NotificationMock() {
      return { onclick: null, close: vi.fn() };
    }) as unknown as typeof Notification;
    Object.defineProperty(NotificationMock, "permission", {
      value: "granted",
      configurable: true,
    });
    vi.stubGlobal("Notification", NotificationMock);
    vi.stubGlobal("navigator", {});

    const channel = createLocalAlertChannel();
    const first = {
      ...sampleAlert,
      key: "offer_expiring:1-place_qualifying:2026-08-10",
      kind: "offer_expiring" as const,
      title: "⚡ £10 edge · Meeting starts in 15 minutes",
    };
    channel.notify(first);
    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(NotificationMock).toHaveBeenCalledTimes(1);

    channel.refresh?.({
      ...first,
      title: "⚡ £10 edge · Meeting starts in 14 minutes",
    });
    expect(toastFn).toHaveBeenCalledTimes(2);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh a toast the user already dismissed", () => {
    vi.stubGlobal("Notification", undefined);
    const channel = createLocalAlertChannel();
    channel.notify(sampleAlert);
    channel.dismiss?.([sampleAlert.key]);
    toastFn.mockClear();
    channel.refresh?.({
      ...sampleAlert,
      title: "⚡ £10 edge · Meeting starts in 14 minutes",
    });
    expect(toastFn).not.toHaveBeenCalled();
  });

  it("dismisses sticky toasts older than the stale threshold", () => {
    vi.stubGlobal("Notification", undefined);
    const channel = createLocalAlertChannel();
    channel.notify(sampleAlert);
    dismissStaleStickyAlertToasts(Date.now() + ALERT_TOAST_STALE_DISMISS_MS);
    expect(toastDismiss).toHaveBeenCalledWith(sampleAlert.key);
  });
});
