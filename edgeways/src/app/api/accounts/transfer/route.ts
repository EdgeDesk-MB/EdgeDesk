import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBalanceSummary,
  transferBetweenAccounts,
} from "@/lib/services/balances";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { denyPublicDemoWrite } from "@/lib/demo/public-demo-guard";

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

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
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
});
