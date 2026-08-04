import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, accounts, exchanges } from "@/lib/db";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { getBalanceSummary } from "@/lib/services/balances";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["bookie", "exchange", "bank"]),
  exchangeId: z.number().optional(),
  brandColor: z.string().optional(),
  openingBalance: z.number().default(0),
  fundedByAccountId: z.number().nullable().optional(),
});

export async function GET() {
  return NextResponse.json(getBalanceSummary());
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.type === "exchange" && input.exchangeId) {
    const ex = db.select().from(exchanges).where(eq(exchanges.id, input.exchangeId)).get();
    if (!ex) return NextResponse.json({ error: "Exchange not found" }, { status: 400 });
  }

  if (input.fundedByAccountId != null) {
    const bank = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.fundedByAccountId))
      .get();
    if (!bank || bank.type !== "bank") {
      return NextResponse.json({ error: "fundedBy must be a bank account" }, { status: 400 });
    }
  }

  const dup = db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .find(
      (a) =>
        a.name.toLowerCase() === input.name.trim().toLowerCase() &&
        a.type === input.type
    );
  if (dup) {
    return NextResponse.json({ error: "An account with this name already exists" }, { status: 409 });
  }

  const inserted = db
    .insert(accounts)
    .values({
      name: input.name.trim(),
      type: input.type,
      exchangeId: input.type === "exchange" ? input.exchangeId : null,
      fundedByAccountId:
        input.type === "bookie" || input.type === "exchange"
          ? input.fundedByAccountId ?? null
          : null,
      brandColor:
        input.brandColor ??
        (input.type === "bookie"
          ? bookieBrandColor(input.name.trim())
          : input.type === "bank"
            ? "#1e3a5f"
            : null),
      isActive: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();

  if (input.openingBalance !== 0) {
    const { recordManualTransaction } = await import("@/lib/services/balances");
    recordManualTransaction(
      inserted.id,
      input.openingBalance,
      "top_up",
      "Opening balance"
    );
  }

  return NextResponse.json({ account: inserted });
}
