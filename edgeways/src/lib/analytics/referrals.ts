/** EDGE-67 client-side referral events. Never send the referee's identity. */
export function captureReferralShared(input: { surface: string }) {
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.capture("referral_shared", { surface: input.surface });
    })
    .catch(() => {
      /* analytics optional */
    });
}
