import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, mugPlans } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonMugPlans, upsertNeonMugPlan } from "@/lib/db/neon-desk-mug-plans";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json({ plans: await listNeonMugPlans() });
  }
  return NextResponse.json({ plans: db.select().from(mugPlans).all() });
});

const upsertSchema = z.object({
  accountId: z.number(),
  cadenceDays: z.number().int().min(1).max(365),
  monthlyBudget: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** Upsert by accountId - one cadence plan per bookie. */
export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (isNeonDesk()) {
    try {
      const plan = await upsertNeonMugPlan(parsed.data);
      return NextResponse.json({ plan });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the mug plan.";
      const status = message.startsWith("Sign in")
        ? 401
        : message.includes("not found")
          ? 404
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
  const input = parsed.data;
  const existing = db
    .select()
    .from(mugPlans)
    .where(eq(mugPlans.accountId, input.accountId))
    .get();
  const row = existing
    ? db
        .update(mugPlans)
        .set({
          cadenceDays: input.cadenceDays,
          monthlyBudget: input.monthlyBudget ?? null,
          notes: input.notes ?? null,
        })
        .where(eq(mugPlans.id, existing.id))
        .returning()
        .get()
    : db
        .insert(mugPlans)
        .values({
          accountId: input.accountId,
          cadenceDays: input.cadenceDays,
          monthlyBudget: input.monthlyBudget ?? null,
          notes: input.notes ?? null,
          createdAt: Date.now(),
        })
        .returning()
        .get();
  return NextResponse.json({ plan: row });
});
