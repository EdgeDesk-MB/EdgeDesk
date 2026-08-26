import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { MAX_FEED_CAP, writeFeedCaps } from "@/lib/admin/feed-caps";
import { loadFeedMonitor } from "@/lib/admin/feeds";

export const dynamic = "force-dynamic";

function parseCap(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const rounded = Math.floor(n);
  if (rounded < 1 || rounded > MAX_FEED_CAP) return null;
  return rounded;
}

export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { football?: unknown; racing?: unknown };
  try {
    body = (await request.json()) as { football?: unknown; racing?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const football = parseCap(body.football);
  const racing = parseCap(body.racing);
  if (football == null || racing == null) {
    return NextResponse.json(
      { error: `Caps must be whole numbers between 1 and ${MAX_FEED_CAP}.` },
      { status: 400 }
    );
  }

  const caps = await writeFeedCaps({ football, racing });
  const monitor = await loadFeedMonitor();
  return NextResponse.json({ ok: true, caps, monitor });
}
