"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/hooks/use-app-state";

/**
 * If the user confirmed 18+ at Clerk sign-up (`unsafeMetadata`), mirror that
 * into local `ageConfirmedAt` so the desk AgeGateDialog does not ask again.
 */
export function SyncClerkAgeConfirmation({
  localAgeConfirmedAt,
  onSynced,
}: {
  localAgeConfirmedAt: number | null | undefined;
  onSynced: () => void;
}) {
  const { user, isLoaded } = useUser();
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || started.current) return;
    if (localAgeConfirmedAt != null) return;

    const meta = user.unsafeMetadata ?? {};
    const confirmed =
      meta.ageConfirmed === true || typeof meta.ageConfirmedAt === "number";
    if (!confirmed) return;

    started.current = true;
    const at =
      typeof meta.ageConfirmedAt === "number"
        ? meta.ageConfirmedAt
        : Date.now();

    void api("/api/settings", {
      method: "PATCH",
      json: { ageConfirmedAt: at },
    })
      .then(() => onSynced())
      .catch(() => {
        started.current = false;
      });
  }, [isLoaded, user, localAgeConfirmedAt, onSynced]);

  return null;
}
