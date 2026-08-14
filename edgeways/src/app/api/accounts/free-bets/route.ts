import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listAllOpenFreeBetLots,
  removeFreeBetLot,
  setFreeBetLotExpiry,
} from "@/lib/accounts/free-bet-lots";
import { quietFreeBetAlerts } from "@/lib/services/quiet-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ lots: listAllOpenFreeBetLots() });
}

const removeSchema = z.object({
  lotId: z.number().int().positive(),
});

/** Remove (write off) remaining balance on a free-bet lot. */
export async function DELETE(req: NextRequest) {
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
}

const expirySchema = z.object({
  lotId: z.number().int().positive(),
  expiresAt: z.number().finite().nullable(),
});

/** Set or clear the conversion deadline on an open free-bet lot. */
export async function PATCH(req: NextRequest) {
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
}
