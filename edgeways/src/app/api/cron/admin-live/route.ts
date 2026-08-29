import { NextResponse } from "next/server";
import { ingestAdminLiveLog } from "@/lib/admin/live-log";
import { runAdminLivePush } from "@/lib/admin/live-push";

export const dynamic = "force-dynamic";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ingest = await ingestAdminLiveLog({ force: true, pingNeon: true });
  const result = await runAdminLivePush();
  return NextResponse.json({
    ok: true,
    ingest: {
      skipped: ingest.skipped,
      recorded: ingest.recorded,
      bundles: ingest.bundles,
    },
    ...result,
  });
}
