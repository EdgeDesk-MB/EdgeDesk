import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, accounts } from "@/lib/db";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { getSettingsBookies, recordManualTransaction } from "@/lib/services/balances";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  brandColor: z.string().optional(),
  openingBalance: z.number().default(0),
});

export async function GET() {
  return NextResponse.json({ bookies: getSettingsBookies() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const name = input.name.trim();

  const dup = db
    .select()
    .from(accounts)
    .all()
    .find((a) => a.type === "bookie" && a.name.toLowerCase() === name.toLowerCase());
  if (dup) {
    if (dup.isActive) {
      return NextResponse.json({ error: "A bookie with this name already exists" }, { status: 409 });
    }
    const reactivated = db
      .update(accounts)
      .set({
        isActive: 1,
        brandColor: input.brandColor ?? dup.brandColor ?? bookieBrandColor(name),
      })
      .where(eq(accounts.id, dup.id))
      .returning()
      .get();
    return NextResponse.json({ bookie: reactivated });
  }

  const inserted = db
    .insert(accounts)
    .values({
      name,
      type: "bookie",
      brandColor: input.brandColor ?? bookieBrandColor(name),
      isActive: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();

  if (input.openingBalance !== 0) {
    recordManualTransaction(inserted.id, input.openingBalance, "top_up", "Opening balance");
  }

  return NextResponse.json({ bookie: inserted });
}
