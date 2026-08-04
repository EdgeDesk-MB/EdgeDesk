import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { demoMarkerPresent, isDemoMode, resolveDbPath, setDemoMarker } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ active: isDemoMode(), markerPresent: demoMarkerPresent() });
}

const bodySchema = z.object({
  enabled: z.boolean(),
  /** Also delete the demo DB file so the next demo run reseeds fresh */
  wipe: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  setDemoMarker(parsed.data.enabled);
  if (parsed.data.wipe && !parsed.data.enabled) {
    // Only ever the demo file - never the real database.
    const demoPath = path.join(path.dirname(resolveDbPath()), "edgeways-demo.db");
    if (demoPath.endsWith("edgeways-demo.db") && !isDemoMode()) {
      fs.rmSync(demoPath, { force: true });
      fs.rmSync(`${demoPath}-wal`, { force: true });
      fs.rmSync(`${demoPath}-shm`, { force: true });
    }
  }
  return NextResponse.json({
    active: isDemoMode(),
    markerPresent: demoMarkerPresent(),
    restartNeeded: isDemoMode() !== demoMarkerPresent(),
  });
}
