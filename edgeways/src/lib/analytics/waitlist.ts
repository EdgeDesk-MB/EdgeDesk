export type WaitlistJoinStatus = "joined" | "already_confirmed";

export function waitlistJoinProperties(input: {
  formId: string;
  status: WaitlistJoinStatus;
}) {
  return {
    form_id: input.formId,
    join_status: input.status,
  };
}

/** Landing conversion. Never send the email address. */
export function captureWaitlistJoined(input: {
  formId: string;
  status: WaitlistJoinStatus;
}) {
  const properties = waitlistJoinProperties(input);
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.capture("waitlist_joined", properties);
    })
    .catch(() => {
      /* analytics optional */
    });
}
