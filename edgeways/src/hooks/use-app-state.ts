"use client";

import {
  noteUserOriginatedSettlesFromRequest,
  noteUserOriginatedSettlesFromResponse,
} from "@/lib/alerts/note-user-settle";
import { cachedGet, clearApiGetCache } from "@/lib/api-get-cache";

export { useAppStateContext as useAppState } from "@/components/app-state-provider";

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const method = (rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase();
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
