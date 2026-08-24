"use client";

import { useEffect, useState } from "react";

export function useAdminSession(): { loaded: boolean; admin: boolean } {
  const [loaded, setLoaded] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/session", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { admin: false }))
      .then((body: { admin?: boolean }) => {
        if (cancelled) return;
        setAdmin(Boolean(body.admin));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAdmin(false);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded, admin };
}
