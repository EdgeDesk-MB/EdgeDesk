import type { LiveEventTone } from "@/lib/admin/live-bundle";

export const ADMIN_LIVE_LOG_CAP = 200;
export const ADMIN_LIVE_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_LIVE_LOG_INGEST_DEBOUNCE_MS = 3000;

export type AdminLiveLogRow = {
  id: number;
  dedupe: string;
  kind: string;
  tone: LiveEventTone;
  title: string;
  body: string | null;
  href: string;
  count: number;
  createdAt: number;
  updatedAt: number;
  readAt: number | null;
};

export type AdminLiveLogList = {
  rows: AdminLiveLogRow[];
  unread: number;
  truncated: boolean;
};
