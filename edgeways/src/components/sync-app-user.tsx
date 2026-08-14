"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * After Clerk sign-in, upsert the hosted `app_users` row keyed by `userId`.
 * Runs once per signed-in session in this tab; retries if the request fails.
 */
export function SyncAppUser() {
  const { isLoaded, isSignedIn } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      inFlight.current = false;
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    void fetch("/api/account/sync", { method: "POST" }).catch(() => {
      inFlight.current = false;
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
