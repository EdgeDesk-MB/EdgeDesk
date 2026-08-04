import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBalanceSummary,
  transferBetweenAccounts,
} from "@/lib/services/balances";

export const dynamic = "force-dynamic";

const schema = z.object({
  bankAccountId: z.number(),
  venueAccountId: z.number(),
  amount: z.number().positive(),
  direction: z.enum(["to_venue", "to_bank"]),
  fee: z.number().min(0).optional(),
  note: z.string().optional(),
  pendingBankCredit: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = transferBetweenAccounts(parsed.data);
    return NextResponse.json({ ...result, ...getBalanceSummary() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
