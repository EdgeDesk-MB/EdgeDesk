import { NextResponse } from "next/server";
import { writeAdminLiveSettings, type AdminLiveSettings } from "@/lib/admin/live-settings";
import { requireOwnerApi } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const gate = await requireOwnerApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const settings = await writeAdminLiveSettings(body as Partial<AdminLiveSettings>);
  return NextResponse.json({ ok: true, settings });
}
