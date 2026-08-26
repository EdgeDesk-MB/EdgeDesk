import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listAllOpenFreeBetLots,
  removeFreeBetLot,
  setFreeBetLotExpiry,
} from "@/lib/accounts/free-bet-lots";
import { quietFreeBetAlerts } from "@/lib/services/quiet-alerts";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import {
  denyPublicDemoWrite,
  isPublicDemoRequest,
} from "@/lib/demo/public-demo-guard";
import { publicDemoApiGet } from "@/lib/demo/public-desk-api";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  if (await isPublicDemoRequest()) {
    return NextResponse.json(publicDemoApiGet("/api/accounts/free-bets"));
  }
  return NextResponse.json({ lots: listAllOpenFreeBetLots() });
});

const removeSchema = z.object({
  lotId: z.number().int().positive(),
});

/** Remove (write off) remaining balance on a free-bet lot. */
export const DELETE = withDeskScope(async function DELETE(req: NextRequest) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const parsed = removeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const removed = removeFreeBetLot(parsed.data.lotId);
    quietFreeBetAlerts(parsed.data.lotId);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
});

const expirySchema = z.object({
  lotId: z.number().int().positive(),
  expiresAt: z.number().finite().nullable(),
});

/** Set or clear the conversion deadline on an open free-bet lot. */
export const PATCH = withDeskScope(async function PATCH(req: NextRequest) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const parsed = expirySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const lot = setFreeBetLotExpiry(parsed.data.lotId, parsed.data.expiresAt);
    return NextResponse.json({ ok: true, lot });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
});
