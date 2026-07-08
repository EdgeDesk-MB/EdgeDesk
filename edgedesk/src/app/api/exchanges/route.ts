import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, exchanges } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  commissionPct: z.number().min(0).max(20).default(0),
  brandColor: z.string().default("#3f3f46"),
  backColor: z.string().default("#a6d8ff"),
  layColor: z.string().default("#fac9d1"),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  return NextResponse.json({ exchanges: db.select().from(exchanges).all() });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  if (input.isDefault) {
    db.update(exchanges).set({ isDefault: 0 }).run();
  }
  const inserted = db
    .insert(exchanges)
    .values({
      name: input.name,
      commissionPct: input.commissionPct,
      brandColor: input.brandColor,
      backColor: input.backColor,
      layColor: input.layColor,
      isDefault: input.isDefault ? 1 : 0,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return NextResponse.json({ exchange: inserted });
}
