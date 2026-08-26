"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Join cookieless PostHog sessions to the Clerk account so onboarding
 * person properties stick to a customer, not a one-off hash.
 * Do not reset anonymous marketing visitors — that drops the landing pageview.
 */
export function PostHogIdentify() {
  const { isLoaded, userId } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    void import("posthog-js")
      .then(({ default: posthog }) => {
        if (userId) posthog.identify(userId);
        else if (previousUserId.current) posthog.reset();
        previousUserId.current = userId ?? null;
      })
      .catch(() => {
        /* analytics optional */
      });
  }, [isLoaded, userId]);

  return null;
}
