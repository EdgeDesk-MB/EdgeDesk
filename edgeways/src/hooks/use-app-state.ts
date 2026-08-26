"use client";

import {
  noteUserOriginatedSettlesFromRequest,
  noteUserOriginatedSettlesFromResponse,
} from "@/lib/alerts/note-user-settle";
import { parseLockedFeedBody } from "@/lib/api-feed-lock";
import { cachedGet, clearApiGetCache } from "@/lib/api-get-cache";
import { publicDemoApiGet } from "@/lib/demo/public-desk-api";
import {
  hasPublicDemoCookieInDocument,
  publicDemoWriteMessage,
} from "@/lib/demo/public-demo";
import { toast } from "sonner";

export { useAppStateContext as useAppState } from "@/components/app-state-provider";

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const method = (rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase();
  if (hasPublicDemoCookieInDocument()) {
    if (method === "GET" || method === "HEAD") {
      const canned = publicDemoApiGet(path);
      if (canned !== undefined) return canned as T;
    } else {
      // EDGE-106: no setup-write exemption - the server 403s these too, and
      // the toast is a kinder failure than a raw error.
      toast.error(publicDemoWriteMessage());
      throw new Error(publicDemoWriteMessage());
    }
  }
  // Mark before fetch so a concurrent state poll cannot sticky-toast first.
  if (method !== "GET" && method !== "HEAD") {
    noteUserOriginatedSettlesFromRequest(path, json);
  }
  const res = await fetch(path, {
    ...rest,
    headers: { "Content-Type": "application/json", ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const locked = parseLockedFeedBody<T>(res.status, body);
    if (locked) return locked;
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  // Mutations change server data - drop warm GETs so the next paint is fresh.
  if (method !== "GET" && method !== "HEAD") {
    clearApiGetCache();
  }
  const data = (await res.json()) as T;
  if (method !== "GET" && method !== "HEAD") {
    noteUserOriginatedSettlesFromResponse(path, json, data);
  }
  return data;
}

/**
 * GET with a short in-memory TTL. Use for page mounts that re-hit the same
 * endpoint on every navigation (History, Casino, Accounts, free-bet lots).
 */
export function apiGet<T = unknown>(path: string, ttlMs?: number): Promise<T> {
  return cachedGet(path, () => api<T>(path), ttlMs);
}
