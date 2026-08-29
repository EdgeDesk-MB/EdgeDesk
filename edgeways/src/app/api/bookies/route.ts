import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, accounts } from "@/lib/db";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { getSettingsBookies, recordManualTransaction } from "@/lib/services/balances";
import { eq } from "drizzle-orm";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { ensureNeonVenueAccount } from "@/lib/db/neon-desk-ensure-venue";
import { getNeonDeskSettingsBookies } from "@/lib/db/neon-desk-balance-summary";
import { recordNeonManualTransaction } from "@/lib/db/neon-desk-accounts";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  brandColor: z.string().optional(),
  openingBalance: z.number().default(0),
});

export const GET = withDeskScope(async function GET() {
  if (isNeonDesk()) {
    return NextResponse.json({ bookies: await getNeonDeskSettingsBookies() });
  }
  return NextResponse.json({ bookies: getSettingsBookies() });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const name = input.name.trim();

  if (isNeonDesk()) {
    try {
      const { listNeonDeskAccounts, patchNeonDeskAccount } = await import(
        "@/lib/db/neon-desk-accounts"
      );
      const existed = (await listNeonDeskAccounts()).some(
        (a) => a.type === "bookie" && a.name.toLowerCase() === name.toLowerCase()
      );
      const { account } = await ensureNeonVenueAccount(name, "bookie");
      const nextColor = input.brandColor ?? account.brandColor ?? bookieBrandColor(name);
      let bookie = account;
      if (nextColor !== account.brandColor) {
        bookie = (await patchNeonDeskAccount(account.id, { brandColor: nextColor })) ?? account;
      }
      const created = !existed;
      if (created && input.openingBalance !== 0) {
        await recordNeonManualTransaction({
          account: bookie,
          amount: input.openingBalance,
          category: "top_up",
          note: "Opening balance",
        });
      }
      return NextResponse.json({ bookie, created });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the bookie.";
      const status = message.startsWith("Sign in") ? 401 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const dup = db
    .select()
    .from(accounts)
    .all()
    .find((a) => a.type === "bookie" && a.name.toLowerCase() === name.toLowerCase());
  if (dup) {
    const nextColor = input.brandColor ?? dup.brandColor ?? bookieBrandColor(name);
    if (dup.isActive) {
      // Idempotent: adopt the submitted brand colour rather than 409.
      const updated =
        nextColor !== dup.brandColor
          ? db
              .update(accounts)
              .set({ brandColor: nextColor })
              .where(eq(accounts.id, dup.id))
              .returning()
              .get()
          : dup;
      return NextResponse.json({ bookie: updated, created: false });
    }
    const reactivated = db
      .update(accounts)
      .set({
        isActive: 1,
        brandColor: nextColor,
      })
      .where(eq(accounts.id, dup.id))
      .returning()
      .get();
    return NextResponse.json({ bookie: reactivated, created: false });
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

  return NextResponse.json({ bookie: inserted, created: true });
});
