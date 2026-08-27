import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { loadFeedStatus, runFeedTest } from "@/lib/admin/feeds";
import { recordFeedHeartbeat } from "@/lib/admin/feed-heartbeat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { kind?: string };
  try {
    body = (await request.json()) as { kind?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "football" && kind !== "racing" && kind !== "exchange") {
    return NextResponse.json({ error: "Unknown feed." }, { status: 400 });
  }

  const result = await runFeedTest(kind);
  await recordFeedHeartbeat(kind, { ok: result.ok, message: result.message });
  const status = await loadFeedStatus();
  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    status: result.providers
      ? { ...status, exchange: { providers: result.providers } }
      : status,
  });
}
