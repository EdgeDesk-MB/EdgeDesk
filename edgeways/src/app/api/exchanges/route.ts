import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, exchanges } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  createNeonDeskExchange,
  listNeonDeskExchanges,
} from "@/lib/db/neon-desk-exchange-rates";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  commissionPct: z.number().min(0).max(20).default(0),
  brandColor: z.string().default("#3f3f46"),
  backColor: z.string().default("#A7D8FF"),
  layColor: z.string().default("#FBC9D2"),
  isDefault: z.boolean().default(false),
});

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    try {
      return NextResponse.json({ exchanges: await listNeonDeskExchanges() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load exchanges.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
  return NextResponse.json({ exchanges: db.select().from(exchanges).all() });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (isNeonDesk()) {
    try {
      const exchange = await createNeonDeskExchange(input);
      return NextResponse.json({ exchange });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the exchange.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

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
});
