import { NextResponse } from "next/server";
import {
  ingestAdminLiveLog,
  listAdminLiveLog,
  markAdminLiveLogRead,
} from "@/lib/admin/live-log";
import { readAdminLiveSettings } from "@/lib/admin/live-settings";
import { requireAdminApi } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const ingest = await ingestAdminLiveLog({ force: false, pingNeon: false });
  const [list, settings] = await Promise.all([
    listAdminLiveLog(),
    readAdminLiveSettings(),
  ]);
  return NextResponse.json({
    ...list,
    ingested: ingest.recorded,
    pollMs: settings.pollMs,
  });
}

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { id?: number; all?: boolean; read?: boolean };
  try {
    body = (await request.json()) as { id?: number; all?: boolean; read?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.read !== true) {
    return NextResponse.json({ error: "read must be true." }, { status: 400 });
  }

  if (body.all === true) {
    const updated = await markAdminLiveLogRead({ all: true });
    return NextResponse.json({ updated });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const updated = await markAdminLiveLogRead({ id });
  return NextResponse.json({ updated });
}
